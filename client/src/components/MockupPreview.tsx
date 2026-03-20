import React from 'react';
import type { Project } from '../types';

interface Props {
  project: Project;
}

export function MockupPreview({ project }: Props) {
  // Find any folder with a mockup_path
  const mockupFolder = project.folders?.find(f => f.visual_spec?.mockup_path);
  const mockupPath = mockupFolder?.visual_spec?.mockup_path;

  if (!mockupPath) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        <div className="text-center">
          <div className="text-4xl mb-3">🎨</div>
          <p>No mockup yet.</p>
          <p className="text-xs mt-1">SMITH generates mockups during Phase 3.</p>
        </div>
      </div>
    );
  }

  // Extract just the filename
  const filename = mockupPath.split('/').pop() || mockupPath;
  const src = `/api/projects/${project.id}/mockup/${filename}`;

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-border text-xs text-text-muted font-mono">
        {mockupPath}
      </div>
      <div className="flex-1 bg-white">
        <iframe
          src={src}
          className="w-full h-full"
          title="Project Mockup"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}
