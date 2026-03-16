/**
 * Contract Generator
 * Improvement 3: API contract generation.
 *
 * Generates API contract files for nodes based on their declared
 * apis_provided and apis_consumed fields. Writes contracts/ directory output.
 *
 * Contract format (TypeScript interface style):
 *   contracts/{nodeId}/{apiName}.contract.ts
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getDb } from '../db';
import { broadcastGlobal } from '../utils/sse';

interface NodeRow {
  id: string;
  name: string;
  parent_id: string | null;
  apis_provided: string | null;
  apis_consumed: string | null;
}

interface ContractRow {
  id: string;
  parent_node_id: string;
  name: string;
  content: string | null;
}

/**
 * Generate contract stub content for a given API name and node.
 */
function generateContractStub(apiName: string, nodeName: string, direction: 'provided' | 'consumed'): string {
  const date = new Date().toISOString().split('T')[0];
  return `/**
 * API Contract: ${apiName}
 * Node: ${nodeName}
 * Direction: ${direction}
 * Generated: ${date}
 *
 * This is an auto-generated contract stub.
 * Edit the 'content' field in the ATO Contract Registry to define the actual interface.
 */

// TODO: Define the interface for ${apiName}
export interface ${toPascalCase(apiName)} {
  // Add your interface fields here
}

// Example request/response types:
export interface ${toPascalCase(apiName)}Request {
  // ...
}

export interface ${toPascalCase(apiName)}Response {
  success: boolean;
  data?: ${toPascalCase(apiName)};
  error?: string;
}
`;
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

/**
 * Generate contract files for a node based on its apis_provided/apis_consumed.
 * Writes to {contractsRoot}/{nodeId}/{apiName}.contract.ts
 */
export async function generateNodeContracts(nodeId: string): Promise<string[]> {
  const db = getDb();
  const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId) as NodeRow | undefined;
  if (!node) throw new Error(`Node ${nodeId} not found`);

  const contractsRoot = process.env.CONTRACTS_ROOT || join(process.cwd(), 'contracts');
  const nodeContractsDir = join(contractsRoot, nodeId);
  mkdirSync(nodeContractsDir, { recursive: true });

  const apisProvided: string[] = node.apis_provided ? JSON.parse(node.apis_provided) : [];
  const apisConsumed: string[] = node.apis_consumed ? JSON.parse(node.apis_consumed) : [];
  const writtenFiles: string[] = [];

  for (const apiName of apisProvided) {
    const filePath = join(nodeContractsDir, `${apiName}.contract.ts`);
    const content = generateContractStub(apiName, node.name, 'provided');
    writeFileSync(filePath, content, 'utf-8');
    writtenFiles.push(filePath);

    // Create/update DB contract record for sibling visibility
    ensureDbContract(node.id, apiName, content);
  }

  for (const apiName of apisConsumed) {
    const filePath = join(nodeContractsDir, `${apiName}.consumed.ts`);
    const content = generateContractStub(apiName, node.name, 'consumed');
    writeFileSync(filePath, content, 'utf-8');
    writtenFiles.push(filePath);
  }

  return writtenFiles;
}

/**
 * Ensure a contract record exists in the DB for a provided API.
 */
function ensureDbContract(nodeId: string, apiName: string, content: string): void {
  const db = getDb();
  const { v4: uuidv4 } = require('uuid') as { v4: () => string };

  const existing = db.prepare(
    'SELECT id FROM contracts WHERE parent_node_id = ? AND name = ?'
  ).get(nodeId, apiName) as { id: string } | undefined;

  if (!existing) {
    db.prepare(`
      INSERT INTO contracts (id, parent_node_id, name, content, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), nodeId, apiName, content, nodeId);

    const contract = db.prepare(
      'SELECT * FROM contracts WHERE parent_node_id = ? AND name = ?'
    ).get(nodeId, apiName) as ContractRow;
    broadcastGlobal('contract:created', { contract });
  }
}

/**
 * Generate contracts for all nodes in a project.
 */
export async function generateProjectContracts(projectId: string): Promise<{ nodeId: string; files: string[] }[]> {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as { root_node_id: string | null } | undefined;
  if (!project?.root_node_id) return [];

  const nodes = db.prepare(`
    WITH RECURSIVE tree(id) AS (
      SELECT ?
      UNION ALL
      SELECT nodes.id FROM nodes JOIN tree ON nodes.parent_id = tree.id
    )
    SELECT * FROM nodes WHERE id IN (SELECT id FROM tree)
  `).all(project.root_node_id) as NodeRow[];

  const results: { nodeId: string; files: string[] }[] = [];
  for (const node of nodes) {
    const files = await generateNodeContracts(node.id);
    if (files.length > 0) {
      results.push({ nodeId: node.id, files });
    }
  }
  return results;
}

/**
 * Get all contracts for a project in registry format.
 */
export function getContractRegistry(projectId: string): {
  nodeId: string;
  nodeName: string;
  contracts: ContractRow[];
  apisProvided: string[];
  apisConsumed: string[];
}[] {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as { root_node_id: string | null } | undefined;
  if (!project?.root_node_id) return [];

  const nodes = db.prepare(`
    WITH RECURSIVE tree(id) AS (
      SELECT ?
      UNION ALL
      SELECT nodes.id FROM nodes JOIN tree ON nodes.parent_id = tree.id
    )
    SELECT id, name, apis_provided, apis_consumed FROM nodes WHERE id IN (SELECT id FROM tree)
    ORDER BY depth, created_at
  `).all(project.root_node_id) as NodeRow[];

  return nodes.map(node => {
    const contracts = db.prepare(
      'SELECT * FROM contracts WHERE parent_node_id = ? ORDER BY updated_at DESC'
    ).all(node.id) as ContractRow[];

    return {
      nodeId: node.id,
      nodeName: node.name,
      contracts,
      apisProvided: node.apis_provided ? JSON.parse(node.apis_provided) : [],
      apisConsumed: node.apis_consumed ? JSON.parse(node.apis_consumed) : [],
    };
  }).filter(r => r.contracts.length > 0 || r.apisProvided.length > 0 || r.apisConsumed.length > 0);
}
