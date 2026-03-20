import React from 'react';
import type { Folder } from '../types';

interface Props {
  folder: Folder;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-800 text-gray-400',
  decomposing: 'bg-blue-900 text-blue-300',
  approved: 'bg-green-900 text-green-300',
  executing: 'bg-indigo-900 text-indigo-300',
  complete: 'bg-green-900 text-green-300',
  failed: 'bg-red-900 text-red-300'
};

export function FolderDetail({ folder }: Props) {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-mono text-sm text-accent font-semibold">{folder.path}</h2>
          <p className="text-text-secondary text-sm mt-1">{folder.description}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[folder.status] || 'bg-gray-800 text-gray-400'}`}>
          {folder.status}
        </span>
      </div>

      {/* Stats */}
      {(folder.cost_usd != null || folder.execution_time_s != null) && (
        <div className="flex gap-4 text-xs text-text-muted font-mono">
          {folder.cost_usd != null && <span>Cost: ${folder.cost_usd.toFixed(3)}</span>}
          {folder.execution_time_s != null && <span>Time: {folder.execution_time_s.toFixed(0)}s</span>}
        </div>
      )}

      {/* Libraries */}
      {folder.libraries && folder.libraries.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Libraries</h3>
          <div className="flex flex-wrap gap-1.5">
            {folder.libraries.map((lib) => (
              <span key={lib} className="text-xs px-2 py-0.5 bg-bg-tertiary border border-border rounded text-text-secondary font-mono">
                {lib}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Contracts */}
      {folder.contracts && (
        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Contracts</h3>
          <div className="space-y-2">
            {folder.contracts.provides?.length > 0 && (
              <div>
                <span className="text-xs text-success">Provides</span>
                <ul className="mt-1 space-y-0.5">
                  {folder.contracts.provides.map((p, i) => (
                    <li key={i} className="text-xs text-text-secondary font-mono pl-2 border-l border-success/30">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {folder.contracts.consumes?.length > 0 && (
              <div>
                <span className="text-xs text-warning">Consumes</span>
                <ul className="mt-1 space-y-0.5">
                  {folder.contracts.consumes.map((c, i) => (
                    <li key={i} className="text-xs text-text-secondary font-mono pl-2 border-l border-warning/30">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Files */}
      {folder.files && folder.files.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Files</h3>
          <div className="space-y-1.5">
            {folder.files.map((file, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-xs text-accent font-mono flex-shrink-0">{file.path}</span>
                <span className="text-xs text-text-muted">{file.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stakeholder notes */}
      {folder.stakeholder_notes && folder.stakeholder_notes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Design Decisions</h3>
          <div className="space-y-3">
            {folder.stakeholder_notes.map((note, i) => (
              <div key={i} className="bg-bg-tertiary rounded p-3 text-xs">
                <div className="text-text-muted mb-1">Q: {note.question}</div>
                <div className="text-text-secondary mb-1">A: {note.answer}</div>
                {note.summary && (
                  <div className="text-text-primary border-t border-border pt-1 mt-1">{note.summary}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflows */}
      {folder.visual_spec?.workflows && folder.visual_spec.workflows.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Workflows</h3>
          <div className="space-y-3">
            {folder.visual_spec.workflows.map((wf, i) => (
              <div key={i} className="bg-bg-tertiary rounded p-3 text-xs space-y-1">
                <div><span className="text-text-muted">Given</span> <span className="text-text-secondary">{wf.given}</span></div>
                <div><span className="text-text-muted">When</span> <span className="text-text-secondary">{wf.when}</span></div>
                <div>
                  <span className="text-text-muted">Then</span>
                  <ul className="mt-1 ml-4 list-disc">
                    {wf.then.map((t, j) => (
                      <li key={j} className="text-text-secondary">{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
