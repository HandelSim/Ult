import React, { useState } from 'react';

interface Props {
  onClose: () => void;
  onConfirm: (description: string) => void;
}

export function NewProjectDialog({ onClose, onConfirm }: Props) {
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      onConfirm(description.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-bg-secondary border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary mb-2">New Project</h2>
        <p className="text-text-muted text-sm mb-4">
          Describe what you want to build. SMITH will take it from there.
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A trading dashboard with real-time P&L tracking..."
            rows={4}
            className="w-full bg-bg-tertiary text-text-primary text-sm rounded px-3 py-2 border border-border focus:outline-none focus:border-accent placeholder-text-muted font-sans resize-none mb-4"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!description.trim()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm rounded font-medium transition-colors"
            >
              Start SMITH
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
