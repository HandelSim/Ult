import React from 'react';

interface Props {
  connected: boolean;
  projectCount: number;
}

export function StatusBar({ connected, projectCount }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-bg-secondary border-t border-border text-xs text-text-muted font-mono">
      <div className="flex items-center gap-4">
        <span className="font-sans font-semibold text-accent text-sm tracking-wide">SCHEMA</span>
        <span>{projectCount} project{projectCount !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-error'}`} />
        <span>{connected ? 'live' : 'disconnected'}</span>
      </div>
    </div>
  );
}
