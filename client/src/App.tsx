import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { TreeView } from './components/TreeView';
import { FolderDetail } from './components/FolderDetail';
import { SmithChat } from './components/SmithChat';
import { MockupPreview } from './components/MockupPreview';
import { NewProjectDialog } from './components/NewProjectDialog';
import { useWebSocket } from './hooks/useWebSocket';
import { fetchProjects, startSmithSession, sendSmithMessage } from './api';
import type { Project, Folder } from './types';

type RightPanel = 'chat' | 'mockup';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>('chat');
  const [showNewDialog, setShowNewDialog] = useState(false);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;
  const selectedFolderData: Folder | null = selectedProject?.folders?.find(f => f.path === selectedFolder) || null;

  // Load projects on mount
  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(console.error);
  }, []);

  const handleWsMessage = useCallback((msg: { type: string; payload: unknown }) => {
    if (msg.type === 'project_list') {
      setProjects(msg.payload as Project[]);
    } else if (msg.type === 'project_update') {
      const updated = msg.payload as Project;
      setProjects(prev =>
        prev.some(p => p.id === updated.id)
          ? prev.map(p => p.id === updated.id ? updated : p)
          : [...prev, updated]
      );
    }
  }, []);

  const { connected } = useWebSocket(handleWsMessage);

  const handleNewProject = async (description: string) => {
    setShowNewDialog(false);
    // Create a temporary project entry — SMITH will fill in the real data
    // For now, just start a SMITH session without a specific project ID
    // The first message will kick off the project creation flow
    // We can use a temporary ID for the session
    const tempId = `new-${Date.now()}`;
    await startSmithSession(tempId).catch(console.error);
    // Send the description as the first message
    await sendSmithMessage(tempId, description).catch(console.error);
    // In a full implementation, we'd redirect to the new project once SMITH creates it
    // For now, just refresh the project list
    setTimeout(async () => {
      const updated = await fetchProjects().catch(() => []);
      if (updated.length > 0) setProjects(updated);
    }, 2000);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          projects={projects}
          selectedId={selectedProjectId}
          onSelect={(id) => {
            setSelectedProjectId(id);
            setSelectedFolder(null);
          }}
          onNewProject={() => setShowNewDialog(true)}
        />

        {/* Main content */}
        {selectedProject ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Tree view */}
            <div className="flex-1 overflow-hidden border-r border-border">
              {/* Project header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <h1 className="text-sm font-semibold text-text-primary">{selectedProject.name}</h1>
                  <div className="text-xs text-text-muted font-mono mt-0.5">{selectedProject.status}</div>
                </div>
                <div className="flex gap-1">
                  {selectedProject.tech_stack?.libraries?.map(lib => (
                    <span key={lib.name} className="text-xs px-1.5 py-0.5 bg-bg-tertiary border border-border rounded text-text-muted font-mono">
                      {lib.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="h-[calc(100%-3rem)]">
                <TreeView
                  project={selectedProject}
                  selectedFolder={selectedFolder}
                  onSelectFolder={setSelectedFolder}
                />
              </div>
            </div>

            {/* Right panel — folder detail + chat/mockup */}
            <div className="w-80 flex flex-col overflow-hidden">
              {/* Folder detail */}
              {selectedFolderData ? (
                <div className="flex-1 overflow-hidden border-b border-border">
                  <FolderDetail folder={selectedFolderData} />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-text-muted text-xs border-b border-border">
                  Select a folder
                </div>
              )}

              {/* Panel switcher */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setRightPanel('chat')}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    rightPanel === 'chat'
                      ? 'text-accent border-b-2 border-accent'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setRightPanel('mockup')}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    rightPanel === 'mockup'
                      ? 'text-accent border-b-2 border-accent'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Mockup
                </button>
              </div>

              {/* Panel content */}
              <div className="flex-1 overflow-hidden" style={{ height: '300px' }}>
                {rightPanel === 'chat' ? (
                  <SmithChat projectId={selectedProject.id} />
                ) : (
                  <MockupPreview project={selectedProject} />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-5xl mb-4">⚒️</div>
              <h2 className="text-lg font-semibold text-text-primary mb-2">SCHEMA</h2>
              <p className="text-sm mb-4">Select a project or start a new one.</p>
              <button
                onClick={() => setShowNewDialog(true)}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded font-medium transition-colors"
              >
                New Project
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <StatusBar connected={connected} projectCount={projects.length} />

      {/* New project dialog */}
      {showNewDialog && (
        <NewProjectDialog
          onClose={() => setShowNewDialog(false)}
          onConfirm={handleNewProject}
        />
      )}
    </div>
  );
}
