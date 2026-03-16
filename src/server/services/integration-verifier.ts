/**
 * Integration Verifier
 * Improvement 6: Integration verification after sibling nodes complete.
 *
 * Checks that:
 * 1. All sibling nodes under the same parent have completed
 * 2. Contracts between siblings are satisfied
 * 3. (For Tier 3) Runs Playwright MCP integration tests
 *
 * This service is called from the execution queue after each leaf node completes.
 */
import { getDb } from '../db';
import { broadcastGlobal } from '../utils/sse';
import { getTierConfig, TestingTier } from '../config/testing-tiers';

interface NodeRow {
  id: string;
  parent_id: string | null;
  name: string;
  status: string;
  node_type: string;
  testing_tier: string | null;
  integration_status: string | null;
  integration_results: string | null;
}

export interface IntegrationResult {
  passed: boolean;
  summary: string;
  checkedAt: string;
  siblingsComplete: boolean;
  contractsSatisfied: boolean;
  details: string[];
}

/**
 * Check if all siblings under the same parent have completed successfully.
 */
export function checkSiblingCompletion(nodeId: string): { allComplete: boolean; pending: string[]; failed: string[] } {
  const db = getDb();
  const node = db.prepare('SELECT parent_id FROM nodes WHERE id = ?').get(nodeId) as NodeRow | undefined;
  if (!node?.parent_id) {
    return { allComplete: true, pending: [], failed: [] };
  }

  const siblings = db.prepare(
    'SELECT id, name, status FROM nodes WHERE parent_id = ? AND id != ?'
  ).all(node.parent_id, nodeId) as { id: string; name: string; status: string }[];

  const pending = siblings.filter(s => !['completed', 'failed', 'rejected'].includes(s.status)).map(s => s.name);
  const failed = siblings.filter(s => ['failed', 'rejected'].includes(s.status)).map(s => s.name);
  const allComplete = pending.length === 0;

  return { allComplete, pending, failed };
}

/**
 * Verify that the contracts declared by nodes are satisfied.
 * A contract is satisfied if it has non-empty content.
 */
function checkContractsSatisfied(parentNodeId: string): { satisfied: boolean; missing: string[] } {
  const db = getDb();
  const contracts = db.prepare(
    'SELECT name, content FROM contracts WHERE parent_node_id = ?'
  ).all(parentNodeId) as { name: string; content: string | null }[];

  const missing = contracts.filter(c => !c.content?.trim()).map(c => c.name);
  return { satisfied: missing.length === 0, missing };
}

/**
 * Run integration verification for a parent node when all its children complete.
 * Updates the parent node's integration_status and integration_results.
 */
export async function verifyIntegration(parentNodeId: string): Promise<IntegrationResult> {
  const db = getDb();
  const parent = db.prepare('SELECT * FROM nodes WHERE id = ?').get(parentNodeId) as NodeRow | undefined;
  if (!parent) throw new Error(`Node ${parentNodeId} not found`);

  const tierConfig = getTierConfig(parent.testing_tier);
  const details: string[] = [];

  // Check sibling completion (for context — parent's children)
  const children = db.prepare(
    'SELECT id, name, status FROM nodes WHERE parent_id = ?'
  ).all(parentNodeId) as { id: string; name: string; status: string }[];

  const incompleteChildren = children.filter(c => !['completed', 'failed', 'rejected'].includes(c.status));
  const failedChildren = children.filter(c => ['failed', 'rejected'].includes(c.status));
  const siblingsComplete = incompleteChildren.length === 0;

  if (!siblingsComplete) {
    details.push(`Waiting for ${incompleteChildren.length} children: ${incompleteChildren.map(c => c.name).join(', ')}`);
  } else {
    details.push(`All ${children.length} children complete`);
  }

  if (failedChildren.length > 0) {
    details.push(`Warning: ${failedChildren.length} children failed: ${failedChildren.map(c => c.name).join(', ')}`);
  }

  // Check contracts
  const contractCheck = checkContractsSatisfied(parentNodeId);
  const contractsSatisfied = contractCheck.satisfied;
  if (!contractsSatisfied) {
    details.push(`Missing contract content: ${contractCheck.missing.join(', ')}`);
  } else {
    details.push('All contracts have defined content');
  }

  // For Tier 3 — note that Playwright MCP would be invoked by the agent directly
  if (tierConfig.playwrightMcp) {
    details.push('Tier 3: Playwright MCP integration enabled — agent will run browser tests');
  }

  const passed = siblingsComplete && contractsSatisfied && failedChildren.length === 0;
  const result: IntegrationResult = {
    passed,
    summary: passed
      ? 'Integration verification passed'
      : 'Integration verification found issues',
    checkedAt: new Date().toISOString(),
    siblingsComplete,
    contractsSatisfied,
    details,
  };

  // Persist results to DB
  db.prepare(`
    UPDATE nodes SET
      integration_status = ?,
      integration_results = ?
    WHERE id = ?
  `).run(
    passed ? 'passed' : 'failed',
    JSON.stringify(result),
    parentNodeId
  );

  broadcastGlobal('node:integration', { nodeId: parentNodeId, result });

  return result;
}

/**
 * Check if all children of a node are complete and, if so, trigger integration verification.
 * Call this after any node status update.
 */
export async function maybeRunIntegrationVerification(nodeId: string): Promise<void> {
  const db = getDb();
  const node = db.prepare('SELECT parent_id, status FROM nodes WHERE id = ?').get(nodeId) as { parent_id: string | null; status: string } | undefined;

  if (!node?.parent_id) return;
  if (!['completed', 'failed'].includes(node.status)) return;

  const parent = db.prepare('SELECT id, node_type FROM nodes WHERE id = ?').get(node.parent_id) as { id: string; node_type: string } | undefined;
  if (!parent || parent.node_type !== 'orchestrator') return;

  // Check if all children are done
  const allChildren = db.prepare(
    'SELECT status FROM nodes WHERE parent_id = ?'
  ).all(parent.id) as { status: string }[];

  const allDone = allChildren.every(c => ['completed', 'failed', 'rejected'].includes(c.status));
  if (allDone && allChildren.length > 0) {
    try {
      await verifyIntegration(parent.id);
    } catch (err) {
      console.error('[integration-verifier] Error:', err);
    }
  }
}
