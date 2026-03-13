/**
 * Workspace Generator
 * Creates the filesystem workspace for each leaf node agent:
 * - CLAUDE.md with cascaded context
 * - .claude/settings.json with hooks configuration
 * - .mcp.json with MCP tool configurations
 * - Copies any context files specified in node config
 *
 * Workspace layout: /workspace/{project-id}/{node-path}/
 * where node-path is derived from the ancestor chain.
 */
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { getDb } from '../db';
import { generateClaudeMd } from './claude-md';

const WORKSPACE_ROOT = process.env.WORKSPACE_PATH || '/workspace';

interface NodeRow {
  id: string;
  parent_id: string | null;
  name: string;
  depth: number;
  node_type: string;
  hooks: string | null;
  mcp_tools: string | null;
  context_files: string | null;
}

/**
 * Build the workspace path for a node by walking up the tree.
 * Result: /workspace/{project-id}/root-name/parent-name/node-name/
 */
function buildNodePath(nodeId: string, projectId: string): string {
  const db = getDb();
  const pathParts: string[] = [];
  let currentId: string | null = nodeId;

  while (currentId) {
    const node = db.prepare('SELECT id, parent_id, name FROM nodes WHERE id = ?').get(currentId) as { id: string; parent_id: string | null; name: string } | undefined;
    if (!node) break;
    pathParts.unshift(node.name.replace(/[^a-zA-Z0-9-_]/g, '-'));
    currentId = node.parent_id;
  }

  return join(WORKSPACE_ROOT, projectId, ...pathParts);
}

/**
 * Generate .claude/settings.json from node hooks configuration.
 * The settings file controls what hooks run before/after tool use.
 */
function generateClaudeSettings(hooks: Record<string, unknown>): string {
  const settings = {
    hooks: hooks,
    // Disable interactive prompts in headless execution
    nonInteractive: true,
  };
  return JSON.stringify(settings, null, 2);
}

/**
 * Generate .mcp.json from node MCP tools configuration.
 * MCP (Model Context Protocol) servers extend Claude's tool capabilities.
 */
function generateMcpConfig(mcpTools: unknown[]): string {
  if (mcpTools.length === 0) {
    return JSON.stringify({ mcpServers: {} }, null, 2);
  }

  // Each MCP tool config should have: name, command, args
  const mcpServers: Record<string, unknown> = {};
  for (const tool of mcpTools) {
    if (tool && typeof tool === 'object') {
      const t = tool as Record<string, unknown>;
      if (t.name && typeof t.name === 'string') {
        mcpServers[t.name] = {
          command: t.command || 'npx',
          args: t.args || [],
          env: t.env || {},
        };
      }
    }
  }

  return JSON.stringify({ mcpServers }, null, 2);
}

/**
 * Main workspace setup function.
 * Creates all necessary files for a node agent to execute.
 * Returns the workspace directory path.
 */
export async function setupWorkspace(nodeId: string, projectId: string): Promise<string> {
  const db = getDb();
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId) as NodeRow | undefined;
  if (!node) throw new Error(`Node ${nodeId} not found`);

  const workspacePath = buildNodePath(nodeId, projectId);
  const claudeDir = join(workspacePath, '.claude');

  // Create directory structure
  mkdirSync(workspacePath, { recursive: true });
  mkdirSync(claudeDir, { recursive: true });

  // Generate and write CLAUDE.md
  const claudeMdContent = generateClaudeMd(nodeId);
  writeFileSync(join(workspacePath, 'CLAUDE.md'), claudeMdContent, 'utf-8');

  // Generate and write .claude/settings.json
  const hooks = node.hooks ? JSON.parse(node.hooks) : {};
  const settingsContent = generateClaudeSettings(hooks);
  writeFileSync(join(claudeDir, 'settings.json'), settingsContent, 'utf-8');

  // Generate and write .mcp.json
  const mcpTools = node.mcp_tools ? JSON.parse(node.mcp_tools) : [];
  const mcpContent = generateMcpConfig(mcpTools);
  writeFileSync(join(workspacePath, '.mcp.json'), mcpContent, 'utf-8');

  // Copy context files if they exist on the host
  const contextFiles: string[] = node.context_files ? JSON.parse(node.context_files) : [];
  for (const filePath of contextFiles) {
    if (existsSync(filePath)) {
      const destPath = join(workspacePath, 'context', filePath.replace(/^\//, ''));
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(filePath, destPath);
    }
  }

  return workspacePath;
}

/**
 * Get the workspace path for a node (without creating it).
 */
export function getWorkspacePath(nodeId: string, projectId: string): string {
  return buildNodePath(nodeId, projectId);
}
