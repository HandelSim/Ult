import React from 'react';
import type { Project } from '../types';

interface Props {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewProject: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  intake: 'text-warning',
  research: 'text-warning',
  mockup: 'text-warning',
  decomposing: 'text-executing',
  executing: 'text-executing',
  complete: 'text-success',
  failed: 'text-error'
};

const STATUS_DOT: Record<string, string> = {
  intake: 'bg-warning',
  research: 'bg-warning',
  mockup: 'bg-warning',
  decomposing: 'bg-executing',
  executing: 'bg-executing',
  complete: 'bg-success',
  failed: 'bg-error'
};

export function Sidebar({ projects, selectedId, onSelect, onNewProject }: Props) {
  return (
    <div className="w-64 bg-bg-secondary border-r border-border flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Projects</span>
        <button
          onClick={onNewProject}
          className="w-7 h-7 flex items-center justify-center rounded bg-accent hover:bg-accent-hover text-white text-lg font-light transition-colors"
          title="New Project"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-muted text-sm">
            <p>No projects yet.</p>
            <p className="mt-1">Start SMITH to create one.</p>
          </div>
        ) : (
          projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelect(project.id)}
              className={`w-full text-left px-4 py-3 border-b border-border hover:bg-bg-tertiary transition-colors ${
                selectedId === project.id ? 'bg-bg-tertiary border-l-2 border-l-accent' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[project.status] || 'bg-pending'}`} />
                <span className="text-sm font-medium text-text-primary truncate">{project.name || project.id}</span>
              </div>
              <div className="mt-0.5 ml-4 flex items-center gap-2">
                <span className={`text-xs ${STATUS_COLORS[project.status] || 'text-text-muted'}`}>{project.status}</span>
                {project.smith?.total_cost_usd != null && (
                  <span className="text-xs text-text-muted">${project.smith.total_cost_usd.toFixed(2)}</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
