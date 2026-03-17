/**
 * Context Generator Service
 * Generates agent context files for each leaf node in a project tree.
 * For each leaf node, creates:
 *   {project-dir}/{node-slug}/CLAUDE.md
 *   {project-dir}/{node-slug}/.claude/settings.json
 *   {project-dir}/{node-slug}/.hammer-config.json
 * Also generates:
 *   {project-dir}/tests/e2e/workflows.spec.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  getProjectDir,
  readProjectFile,
  NodeRecord,
  ContractRecord,
  WorkflowRecord,
  ProjectFile,
} from './project-store';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert a node name to a slug: lowercase, spaces to hyphens, non-alphanumeric removed.
 */
export function nodeNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Find a contract record by name.
 */
function findContract(contracts: ContractRecord[], name: string): ContractRecord | undefined {
  return contracts.find(c => c.name === name);
}

// ─── File Generators ─────────────────────────────────────────────────────────

function generateClaudeMdContent(
  node: NodeRecord,
  projectData: ProjectFile,
  contracts: ContractRecord[]
): string {
  const { project, nodes, stakeholder } = projectData;

  // Build stakeholder requirements section
  const clarificationLines = stakeholder.clarifications.map(
    c => `- **Q:** ${c.question}\n  **A:** ${c.answer}`
  );
  const decisionLines = stakeholder.decisions.map(
    d => `- **${d.topic}:** ${d.decision} (${d.reasoning})`
  );
  const stakeholderSection = [
    ...(clarificationLines.length > 0 ? ['### Clarifications', ...clarificationLines] : []),
    ...(decisionLines.length > 0 ? ['### Decisions', ...decisionLines] : []),
  ].join('\n') || 'No stakeholder data recorded yet.';

  // Build contracts provided section
  const contractsProvidedSection = node.contracts_provided.length > 0
    ? node.contracts_provided.map(name => {
        const contract = findContract(contracts, name);
        if (!contract) return `### ${name}\n(Contract definition not found)`;
        return `### ${name}\n\`\`\`${contract.type}\n${contract.content}\n\`\`\``;
      }).join('\n\n')
    : 'None';

  // Build contracts consumed section
  const contractsConsumedSection = node.contracts_consumed.length > 0
    ? node.contracts_consumed.map(name => {
        const contract = findContract(contracts, name);
        if (!contract) return `### ${name}\n(Contract definition not found)`;
        return `### ${name}\n\`\`\`${contract.type}\n${contract.content}\n\`\`\``;
      }).join('\n\n')
    : 'None';

  // Build sibling nodes section
  const siblingNodes = nodes.filter(n => n.id !== node.id && n.parent_id === node.parent_id);
  const siblingSection = siblingNodes.length > 0
    ? siblingNodes.map(n => `- **${n.name}**: ${n.prompt.split('\n')[0].slice(0, 100)}`).join('\n')
    : 'No sibling nodes.';

  return `# ${node.name}

## Your Task
${node.prompt}

This folder is your workspace. Build everything needed for this component here.

## Project Context
${project.prompt}

## Stakeholder Requirements
${stakeholderSection}

## API Contracts
### Contracts You Implement
${contractsProvidedSection}

### Contracts You Consume
${contractsConsumedSection}

## Sibling Nodes
${siblingSection}

## Acceptance Criteria
${node.acceptance_criteria || 'No acceptance criteria specified.'}
`;
}

function generateSettingsJson(): object {
  return {
    hooks: {
      PostToolUse: [
        {
          matcher: 'Write|Edit|MultiEdit',
          hooks: [
            {
              type: 'command',
              command: "echo 'File modified'",
              timeout: 5,
            },
          ],
        },
      ],
    },
  };
}

function generateHammerConfig(node: NodeRecord, nodeFolderPath: string): object {
  return {
    prompt: node.prompt,
    cwd: nodeFolderPath,
    model: node.model,
    acceptanceChecks: [],
    subagents: {},
  };
}

function generateWorkflowsSpec(workflows: WorkflowRecord[]): string {
  const approvedWorkflows = workflows.filter(w => w.approved);

  if (approvedWorkflows.length === 0) {
    return `/**
 * Workflow E2E Tests
 * Auto-generated from stakeholder workflow documentation.
 */
import { test, expect } from '@playwright/test';

test.describe('Stakeholder Workflows', () => {
  test('placeholder - no workflows defined yet', async ({ page }) => {
    // No workflows have been documented yet.
    // This test will be populated once workflows are approved.
    expect(true).toBe(true);
  });
});
`;
  }

  const testBlocks = approvedWorkflows.map(workflow => {
    const stepComments = workflow.steps.map(
      (step, i) => `    // Step ${i + 1}: ${step.action} on ${step.target}${step.value ? ` with value "${step.value}"` : ''} - expected: ${step.expected}`
    ).join('\n');
    return `  test('${workflow.name.replace(/'/g, "\\'")}', async ({ page }) => {
    // ${workflow.description}
${stepComments}
    // TODO: Implement steps above
    expect(true).toBe(true);
  });`;
  });

  return `/**
 * Workflow E2E Tests
 * Auto-generated from stakeholder workflow documentation.
 */
import { test, expect } from '@playwright/test';

test.describe('Stakeholder Workflows', () => {
${testBlocks.join('\n\n')}
});
`;
}

// ─── Main Generator ──────────────────────────────────────────────────────────

export interface GeneratedContextFile {
  path: string;
  type: 'claude-md' | 'settings' | 'hammer-config' | 'workflows-spec';
}

export interface GenerateContextsResult {
  generatedFiles: GeneratedContextFile[];
  leafNodes: string[];
}

/**
 * Generate context files for all leaf nodes of a project.
 * Returns a list of all generated file paths.
 */
export async function generateContexts(projectId: string): Promise<GenerateContextsResult> {
  const projectData = readProjectFile(projectId);
  const projectDir = getProjectDir(projectId);
  const { nodes, contracts, stakeholder } = projectData;

  const generatedFiles: GeneratedContextFile[] = [];
  const leafNodeNames: string[] = [];

  // Generate files for each leaf node
  const leafNodes = nodes.filter(n => n.is_leaf);

  for (const node of leafNodes) {
    const slug = nodeNameToSlug(node.name);
    const nodeFolderPath = path.join(projectDir, slug);

    // Create node directory and .claude subdirectory
    fs.mkdirSync(nodeFolderPath, { recursive: true });
    fs.mkdirSync(path.join(nodeFolderPath, '.claude'), { recursive: true });

    // Generate CLAUDE.md
    const claudeMdContent = generateClaudeMdContent(node, projectData, contracts);
    const claudeMdPath = path.join(nodeFolderPath, 'CLAUDE.md');
    fs.writeFileSync(claudeMdPath, claudeMdContent, 'utf-8');
    generatedFiles.push({ path: claudeMdPath, type: 'claude-md' });

    // Generate .claude/settings.json
    const settingsContent = generateSettingsJson();
    const settingsPath = path.join(nodeFolderPath, '.claude', 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(settingsContent, null, 2), 'utf-8');
    generatedFiles.push({ path: settingsPath, type: 'settings' });

    // Generate .hammer-config.json
    const hammerConfig = generateHammerConfig(node, nodeFolderPath);
    const hammerConfigPath = path.join(nodeFolderPath, '.hammer-config.json');
    fs.writeFileSync(hammerConfigPath, JSON.stringify(hammerConfig, null, 2), 'utf-8');
    generatedFiles.push({ path: hammerConfigPath, type: 'hammer-config' });

    leafNodeNames.push(node.name);
  }

  // Generate tests/e2e/workflows.spec.ts from stakeholder workflows
  const testsDir = path.join(projectDir, 'tests', 'e2e');
  fs.mkdirSync(testsDir, { recursive: true });
  const workflowsSpecContent = generateWorkflowsSpec(stakeholder.workflows);
  const workflowsSpecPath = path.join(testsDir, 'workflows.spec.ts');
  fs.writeFileSync(workflowsSpecPath, workflowsSpecContent, 'utf-8');
  generatedFiles.push({ path: workflowsSpecPath, type: 'workflows-spec' });

  return { generatedFiles, leafNodes: leafNodeNames };
}
