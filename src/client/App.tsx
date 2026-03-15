/**
 * App - Main application shell with three-panel layout.
 */
import React, { useState, useCallback } from 'react';
import { useTree } from './hooks/useTree';
import { useNode } from './hooks/useNode';
import { TreeGraph } from './components/TreeGraph';
import { NodeDetail } from './components/NodeDetail';
import { ExecutionLog } from './components/ExecutionLog';
import { StatusBadge } from './components/StatusBadge';
import { Project } from './types';

// ============================================================
// Project Creation Modal
// ============================================================
interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setLoading(true);
    try {
      await onCreate(name, description);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">Create New Project</h2>
          <p className="text-sm text-gray-400 mt-1">Define the root node — Claude will decompose it into agents.</p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Project Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. E-commerce Platform v2"
              required
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Project Goal / Description *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Be as descriptive as possible — include tech stack, constraints, and end goals. The more detail you provide, the better Claude can plan."
              rows={6}
              required
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !name.trim() || !description.trim()}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-600 text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================
// Project Selector Sidebar
// ============================================================
interface ProjectSidebarProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({ projects, selectedId, onSelect, onCreate }) => (
  <div className="h-full flex flex-col bg-gray-900 text-white">
    <div className="px-3 py-3 border-b border-gray-700">
      <div className="flex items-center justify-between">
        <h1 className="text-xs font-bold text-white tracking-wide leading-tight" title="Agent Tree Orchestrator — Recursively decompose projects into AI agent trees">
            🌳 Project Orchestrator
          </h1>
        <button
          onClick={onCreate}
          className="text-xs px-2 py-1 bg-blue-600 rounded hover:bg-blue-700 text-white"
        >
          + New
        </button>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto py-2">
      {projects.length === 0 ? (
        <div className="px-3 py-4 text-center">
          <p className="text-xs text-gray-500">No projects yet</p>
          <button onClick={onCreate} className="mt-2 text-xs text-blue-400 hover:text-blue-300">
            Create your first project →
          </button>
        </div>
      ) : (
        projects.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`w-full text-left px-3 py-2.5 hover:bg-gray-800 transition-colors ${
              selectedId === p.id ? 'bg-gray-800 border-l-2 border-blue-400' : ''
            }`}
          >
            <div className="text-sm font-medium text-gray-200 truncate">{p.name}</div>
            <div className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString()}</div>
          </button>
        ))
      )}
    </div>
  </div>
);

// ============================================================
// Main App
// ============================================================
export default function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<'graph' | 'detail'>('graph');
  const [projectMode, setProjectMode] = useState<'manual' | 'auto'>('manual');
  // Tracks a node to auto-select once the new tree loads after project creation
  const [pendingNodeSelect, setPendingNodeSelect] = useState<string | null>(null);

  const handleToggleMode = useCallback(async () => {
    if (!selectedProjectId) return;
    const newMode = projectMode === 'manual' ? 'auto' : 'manual';
    setProjectMode(newMode);
    fetch(`/api/projects/${selectedProjectId}/mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: newMode }),
    }).catch(console.error);
  }, [selectedProjectId, projectMode]);

  React.useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: { projects: Project[] }) => {
        setProjects(data.projects || []);
        if (data.projects?.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data.projects[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const tree = useTree(selectedProjectId);
  const { node: selectedNode, logs: nodeLogs, clearLogs } = useNode(tree.selectedNodeId);

  // Auto-select pending node once the tree has loaded for the new project
  React.useEffect(() => {
    if (pendingNodeSelect && tree.nodes.length > 0) {
      tree.setSelectedNodeId(pendingNodeSelect);
      setPendingNodeSelect(null);
      setViewMode('detail');
    }
  }, [pendingNodeSelect, tree.nodes, tree.setSelectedNodeId]);

  const handleCreateProject = useCallback(async (name: string, description: string) => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!response.ok) throw new Error((await response.json() as { error: string }).error);
    const data = await response.json() as { project: Project; rootNode: { id: string } };
    setProjects(prev => [data.project, ...prev]);
    setSelectedProjectId(data.project.id);
    // Queue root node for selection once the new tree has loaded
    if (data.rootNode?.id) {
      setPendingNodeSelect(data.rootNode.id);
    }
  }, []);

  const handleSelectNode = useCallback((nodeId: string) => {
    tree.setSelectedNodeId(nodeId);
    setViewMode('detail');
  }, [tree]);

  const allLogs = [
    ...tree.logs,
    ...nodeLogs.filter(l => !tree.logs.some(tl => tl.id === l.id)),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="h-screen flex overflow-hidden bg-gray-950 font-sans">
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateProject}
        />
      )}

      {/* Left: Project sidebar */}
      <div className="w-44 flex-shrink-0 border-r border-gray-800">
        <ProjectSidebar
          projects={projects}
          selectedId={selectedProjectId}
          onSelect={id => { setSelectedProjectId(id); tree.setSelectedNodeId(null); }}
          onCreate={() => setShowCreateModal(true)}
        />
      </div>

      {/* Center: Graph + Node detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-10 flex items-center gap-3 px-4 bg-gray-900 border-b border-gray-700 flex-shrink-0">
          {tree.project && (
            <>
              <h2 className="text-sm font-semibold text-gray-200 truncate">{tree.project.name}</h2>
              <div className="flex-1" />
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>{tree.nodes.length} nodes</span>
                <span>·</span>
                <span>{tree.nodes.filter(n => n.status === 'completed').length} done</span>
              </div>
              <div className="flex border border-gray-700 rounded overflow-hidden">
                <button
                  onClick={() => setViewMode('graph')}
                  className={`text-xs px-3 py-1 ${viewMode === 'graph' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                >
                  Graph
                </button>
                <button
                  onClick={() => setViewMode('detail')}
                  disabled={!tree.selectedNodeId}
                  className={`text-xs px-3 py-1 disabled:opacity-40 ${viewMode === 'detail' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                >
                  Detail
                </button>
              </div>
              {/* Mode toggle */}
              <div className="flex items-center border border-gray-700 rounded overflow-hidden">
                <button
                  onClick={() => projectMode !== 'manual' && handleToggleMode()}
                  className={`text-xs px-2 py-1 ${projectMode === 'manual' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                >
                  Manual
                </button>
                <button
                  onClick={() => projectMode !== 'auto' && handleToggleMode()}
                  className={`text-xs px-2 py-1 ${projectMode === 'auto' ? 'bg-emerald-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
                >
                  Auto
                </button>
              </div>
              <button
                onClick={tree.refreshTree}
                className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-400 hover:bg-gray-800"
              >
                ↻ Refresh
              </button>
            </>
          )}
          {!tree.project && (
            <span className="text-sm text-gray-500">
              {selectedProjectId ? 'Loading...' : 'Select or create a project'}
            </span>
          )}
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 min-w-0 relative">
            {tree.loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 z-10">
                <div className="text-sm text-gray-400 animate-pulse">Loading tree...</div>
              </div>
            )}

            {tree.error && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-950 border border-red-800 rounded-lg p-3 z-10">
                <p className="text-sm text-red-400">{tree.error}</p>
              </div>
            )}

            {!selectedProjectId ? (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <div className="text-4xl mb-4">🌳</div>
                  <h3 className="text-lg font-semibold text-gray-300">Agent Tree Orchestrator</h3>
                  <p className="text-sm text-gray-500 mt-2 max-w-sm">
                    Recursively decompose projects into AI agent trees.
                    Create a project to get started.
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    Create First Project
                  </button>
                </div>
              </div>
            ) : viewMode === 'graph' || !tree.selectedNodeId ? (
              <div className="h-full">
                <TreeGraph
                  nodes={tree.nodes}
                  selectedNodeId={tree.selectedNodeId}
                  onSelectNode={handleSelectNode}
                />
                {tree.nodes.length === 0 && !tree.loading && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-2xl mb-2">⬆️</div>
                      <p className="text-sm text-gray-500">No nodes yet. Approve the root node to decompose.</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              selectedNode ? (
                <NodeDetail
                  node={selectedNode}
                  allNodes={tree.nodes}
                  contracts={tree.contracts}
                  onApprove={tree.approveNode}
                  onReject={tree.rejectNode}
                  onExecute={tree.executeNode}
                  onVerify={tree.verifyNode}
                  onUpdate={tree.updateNode}
                  onDelete={tree.deleteNode}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-gray-500 animate-pulse">Loading node...</p>
                </div>
              )
            )}
          </div>

          {/* Right: Node list navigator */}
          {viewMode === 'graph' && tree.nodes.length > 0 && (
            <div className="w-56 flex-shrink-0 border-l border-gray-700 bg-gray-900 overflow-y-auto">
              <div className="px-3 py-2 border-b border-gray-700 sticky top-0 bg-gray-900">
                <span className="text-xs font-medium text-gray-400">All Nodes ({tree.nodes.length})</span>
              </div>
              {tree.nodes.map(node => (
                <button
                  key={node.id}
                  onClick={() => handleSelectNode(node.id)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                    tree.selectedNodeId === node.id ? 'bg-gray-800 border-l-2 border-blue-500' : ''
                  }`}
                  style={{ paddingLeft: `${(node.depth + 1) * 8}px` }}
                >
                  <div className="text-xs font-medium text-gray-300 truncate">{node.name}</div>
                  <StatusBadge status={node.status} size="sm" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Execution log */}
      <div className="w-72 flex-shrink-0 border-l border-gray-800">
        <ExecutionLog
          logs={allLogs}
          onClear={() => { tree.clearLogs(); clearLogs(); }}
          title={tree.selectedNodeId ? `Logs: ${selectedNode?.name || '...'}` : 'System Logs'}
        />
      </div>
    </div>
  );
}
