/**
 * NodeDetail - The central panel for viewing and editing a selected node.
 * Shows all node properties and provides action buttons for the node lifecycle.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { TreeNode, Contract } from '../types';
import { StatusBadge, TypeBadge } from './StatusBadge';
import { PromptEditor } from './PromptEditor';
import { ConfigAccordion } from './ConfigAccordion';
import { ContractEditor } from './ContractEditor';

interface NodeDetailProps {
  node: TreeNode;
  allNodes: TreeNode[];
  contracts: Contract[];
  onApprove: (nodeId: string, decompose: boolean) => Promise<void>;
  onReject: (nodeId: string, feedback?: string) => Promise<void>;
  onExecute: (nodeId: string) => Promise<void>;
  onVerify: (nodeId: string) => Promise<void>;
  onUpdate: (nodeId: string, updates: Partial<TreeNode>) => Promise<void>;
  onDelete: (nodeId: string) => Promise<void>;
}

export const NodeDetail: React.FC<NodeDetailProps> = ({
  node,
  allNodes,
  contracts,
  onApprove,
  onReject,
  onExecute,
  onVerify,
  onUpdate,
  onDelete,
}) => {
  const [editing, setEditing] = useState(false);
  const [draftNode, setDraftNode] = useState<TreeNode>(node);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'contracts' | 'children'>('config');

  // Reset draft when selected node changes
  useEffect(() => {
    setDraftNode(node);
    setEditing(false);
  }, [node.id, node]);

  const children = allNodes.filter(n => n.parent_id === node.id);
  const nodeContracts = contracts.filter(c => c.parent_node_id === node.id);

  const handleAction = useCallback(async (action: string, fn: () => Promise<void>) => {
    setActionLoading(action);
    try {
      await fn();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(node.id, draftNode);
      setEditing(false);
    } catch (err) {
      alert(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (updates: Partial<TreeNode>) => {
    setDraftNode(prev => ({ ...prev, ...updates }));
  };

  const isRunning = node.status === 'running' || node.status === 'decomposing';
  const canApprove = ['pending', 'rejected', 'failed'].includes(node.status);
  const canExecute = node.node_type !== 'orchestrator' && ['approved', 'failed'].includes(node.status);
  const canEdit = ['pending', 'approved', 'failed', 'rejected'].includes(node.status);

  const displayNode = editing ? draftNode : node;

  const handleContractUpdate = async (contractId: string, content: string) => {
    await fetch(`/api/contracts/${contractId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  };

  const handleContractCreate = async (name: string, content: string) => {
    await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_node_id: node.id, name, content }),
    });
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">{node.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <StatusBadge status={node.status} />
              <TypeBadge type={node.node_type} />
              {node.role && (
                <span className="text-xs text-gray-500 italic">{node.role}</span>
              )}
              <span className="text-xs text-gray-400">Depth: {node.depth}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {canEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
              >
                Edit
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setDraftNode(node); setEditing(false); }}
                  className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Timing info */}
        {(node.started_at || node.completed_at) && (
          <div className="text-xs text-gray-400 mt-1 flex gap-3">
            {node.started_at && <span>Started: {new Date(node.started_at).toLocaleString()}</span>}
            {node.completed_at && <span>Completed: {new Date(node.completed_at).toLocaleString()}</span>}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 py-2 border-b border-gray-100 flex gap-2 flex-wrap flex-shrink-0 bg-gray-50">
        {canApprove && (
          <>
            {node.node_type !== 'leaf' && (
              <button
                onClick={() => handleAction('approve-decompose', () => onApprove(node.id, true))}
                disabled={!!actionLoading || isRunning}
                className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {actionLoading === 'approve-decompose' ? '...' : '🔱 Approve & Decompose'}
              </button>
            )}
            <button
              onClick={() => handleAction('approve-leaf', () => onApprove(node.id, false))}
              disabled={!!actionLoading || isRunning}
              className="text-xs px-3 py-1.5 rounded bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 font-medium"
            >
              {actionLoading === 'approve-leaf' ? '...' : '✓ Approve as Leaf'}
            </button>
          </>
        )}

        {canExecute && (
          <button
            onClick={() => handleAction('execute', () => onExecute(node.id))}
            disabled={!!actionLoading}
            className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 font-medium"
          >
            {actionLoading === 'execute' ? '...' : '▶ Execute'}
          </button>
        )}

        {isRunning && (
          <span className="text-xs px-3 py-1.5 text-yellow-700 bg-yellow-100 rounded font-medium animate-pulse">
            ⏳ {node.status === 'decomposing' ? 'Decomposing...' : 'Running...'}
          </span>
        )}

        {node.status === 'completed' && (
          <button
            onClick={() => handleAction('verify', () => onVerify(node.id))}
            disabled={!!actionLoading}
            className="text-xs px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 font-medium"
          >
            {actionLoading === 'verify' ? '...' : '✓ Verify'}
          </button>
        )}

        {canApprove && (
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={!!actionLoading || isRunning}
            className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            ✕ Reject
          </button>
        )}

        <button
          onClick={() => {
            if (confirm(`Delete node "${node.name}" and all its children?`)) {
              handleAction('delete', () => onDelete(node.id));
            }
          }}
          disabled={!!actionLoading || isRunning}
          className="ml-auto text-xs px-2 py-1.5 rounded border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 disabled:opacity-50"
        >
          🗑
        </button>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-80 shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-3">Reject Node</h3>
            <textarea
              value={rejectFeedback}
              onChange={e => setRejectFeedback(e.target.value)}
              placeholder="Reason for rejection (optional)..."
              rows={4}
              className="w-full text-sm border border-gray-300 rounded p-2 mb-3 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  handleAction('reject', () => onReject(node.id, rejectFeedback));
                }}
                className="flex-1 text-sm py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reject
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 text-sm py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Prompt */}
        <div className="px-4 py-3 border-b border-gray-100">
          <PromptEditor
            value={displayNode.prompt || ''}
            onChange={v => editing && updateDraft({ prompt: v })}
            readOnly={!editing}
            label="Task Prompt"
            rows={5}
          />
        </div>

        {/* Role */}
        <div className="px-4 py-2 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
          <input
            type="text"
            value={displayNode.role || ''}
            onChange={e => editing && updateDraft({ role: e.target.value })}
            readOnly={!editing}
            placeholder="e.g. Senior Backend Engineer"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-4">
          {(['config', 'contracts', 'children'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab} {tab === 'contracts' && `(${nodeContracts.length})`}
              {tab === 'children' && `(${children.length})`}
            </button>
          ))}
        </div>

        <div className="px-4 py-3">
          {activeTab === 'config' && (
            <ConfigAccordion
              node={displayNode}
              onUpdate={updateDraft}
              readOnly={!editing}
            />
          )}

          {activeTab === 'contracts' && (
            <ContractEditor
              contracts={nodeContracts}
              parentNodeId={node.id}
              onUpdate={handleContractUpdate}
              onCreate={handleContractCreate}
            />
          )}

          {activeTab === 'children' && (
            <div className="space-y-2">
              {children.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  {node.node_type === 'orchestrator' && node.status === 'pending'
                    ? 'Approve & Decompose to generate children.'
                    : 'No child nodes.'}
                </p>
              ) : (
                children.map(child => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between p-2 rounded border border-gray-200 text-sm"
                  >
                    <div>
                      <span className="font-medium text-gray-800">{child.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{child.role}</span>
                    </div>
                    <StatusBadge status={child.status} size="sm" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Error log display */}
        {node.error_log && (
          <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-xs font-medium text-red-700 mb-1">Error Log</h4>
            <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono">{node.error_log}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
