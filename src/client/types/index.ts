/**
 * Shared TypeScript type definitions for the ATO frontend.
 * These mirror the database schema and API response shapes.
 */

export type NodeStatus =
  | 'pending'
  | 'approved'
  | 'decomposing'
  | 'running'
  | 'completed'
  | 'failed'
  | 'rejected';

export type ProjectStatus =
  | 'building'
  | 'tree_approved'
  | 'contexts_generating'
  | 'contexts_generated'
  | 'executing'
  | 'completed'
  | 'failed';

export type TestingTier = 'tier1' | 'tier2' | 'tier3';

export type NodeType = 'orchestrator' | 'leaf' | 'test';

export type ModelType = 'sonnet' | 'haiku' | 'opus';

export type EscalationPolicy = 'ask_human' | 'auto_retry' | 'fail';

export interface HookCommand {
  type: 'command';
  command: string;
}

export interface HookMatcher {
  matcher: string;
  hooks: HookCommand[];
}

export interface HookConfig {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
}

export interface MCPTool {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface TreeNode {
  id: string;
  parent_id: string | null;
  name: string;
  depth: number;
  status: NodeStatus;
  node_type: NodeType;
  prompt: string | null;
  role: string | null;
  system_prompt: string | null;
  hooks: HookConfig | null;
  mcp_tools: MCPTool[];
  allowed_tools: string[];
  allowed_paths: string[];
  dependencies: string[];
  acceptance_criteria: string | null;
  context_files: string[];
  max_iterations: number;
  escalation_policy: EscalationPolicy;
  model: ModelType;
  // Improvement 1: testing tier
  testing_tier: TestingTier;
  // Improvement 3: API contracts
  apis_provided: string[];
  apis_consumed: string[];
  // Improvement 6: integration verification
  integration_status: string | null;
  integration_results: string | null;
  started_at: string | null;
  completed_at: string | null;
  execution_log: string | null;
  error_log: string | null;
  created_at: string;
}

export interface Contract {
  id: string;
  parent_node_id: string;
  name: string;
  content: string | null;
  created_by: string | null;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  root_node_id: string | null;
  mode: 'manual' | 'auto';
  // Improvement 2: lifecycle phases
  status: ProjectStatus;
  created_at: string;
}

export interface ContractProposal {
  id: string;
  contract_id: string;
  proposed_by: string | null;
  old_content: string | null;
  new_content: string;
  change_type: 'backward_compatible' | 'breaking' | 'unknown';
  status: 'pending' | 'approved' | 'rejected';
  analysis: string | null;
  reviewed_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface TreeData {
  project: Project;
  nodes: TreeNode[];
  contracts: Contract[];
}

export interface VerificationResult {
  passed: boolean;
  summary: string;
  issues: string[];
  recommendations: string[];
}

// For React Flow graph nodes
export interface FlowNodeData {
  node: TreeNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
}

// SSE event payloads
export type SSEEvent =
  | { type: 'node:status'; nodeId: string; status: NodeStatus }
  | { type: 'node:created'; node: TreeNode }
  | { type: 'node:updated'; node: TreeNode }
  | { type: 'node:deleted'; nodeId: string }
  | { type: 'log:output'; message: string; timestamp: string }
  | { type: 'log:error'; message: string; timestamp: string }
  | { type: 'log:complete'; status: string; exitCode?: number }
  | { type: 'log:history'; message: string }
  | { type: 'verification'; result: VerificationResult }
  | { type: 'connected'; clientId: string }
  | { type: 'project:created'; project: Project; rootNode: TreeNode }
  | { type: 'contract:created'; contract: Contract }
  | { type: 'contract:updated'; contract: Contract };

export interface LogEntry {
  id: string;
  message: string;
  timestamp: string;
  type: 'output' | 'error' | 'system' | 'history';
}
