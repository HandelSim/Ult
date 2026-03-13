/**
 * HookTemplates - UI for applying pre-defined hook configurations to nodes.
 */
import React from 'react';
import { HookConfig } from '../types';

interface HookTemplate {
  id: string;
  name: string;
  description: string;
  config: HookConfig;
}

const TEMPLATES: HookTemplate[] = [
  {
    id: 'codeQuality',
    name: 'Code Quality',
    description: 'Auto-format with Prettier + ESLint after writes',
    config: {
      PostToolUse: [{
        matcher: 'Write|Edit',
        hooks: [
          { type: 'command', command: 'npx prettier --write "$CLAUDE_FILE_PATH" 2>/dev/null || true' },
          { type: 'command', command: 'npx eslint --fix "$CLAUDE_FILE_PATH" 2>/dev/null || true' },
        ]
      }]
    }
  },
  {
    id: 'pathBoundary',
    name: 'Path Boundary',
    description: 'Block writes outside allowed paths',
    config: {
      PreToolUse: [{
        matcher: 'Write|Edit',
        hooks: [{ type: 'command', command: 'python3 $CLAUDE_PROJECT_DIR/scripts/enforce_boundaries.py' }]
      }]
    }
  },
  {
    id: 'typeCheck',
    name: 'Type Check',
    description: 'Run tsc --noEmit after code changes',
    config: {
      PostToolUse: [{
        matcher: 'Write|Edit',
        hooks: [{ type: 'command', command: 'npx tsc --noEmit 2>&1 | head -20 || true' }]
      }]
    }
  },
  {
    id: 'testRunner',
    name: 'Test Runner',
    description: 'Run Jest tests after changes',
    config: {
      PostToolUse: [{
        matcher: 'Write|Edit',
        hooks: [{ type: 'command', command: 'npx jest --passWithNoTests --bail 2>&1 | tail -10 || true' }]
      }]
    }
  },
  {
    id: 'secretDetection',
    name: 'Secret Detection',
    description: 'Block files containing secrets',
    config: {
      PreToolUse: [{
        matcher: 'Write|Edit',
        hooks: [{ type: 'command', command: 'python3 $CLAUDE_PROJECT_DIR/scripts/detect_secrets.py' }]
      }]
    }
  },
];

interface HookTemplatesProps {
  currentHooks: HookConfig | null;
  onApply: (hooks: HookConfig) => void;
}

export const HookTemplates: React.FC<HookTemplatesProps> = ({ currentHooks, onApply }) => {
  const [expanded, setExpanded] = React.useState(false);

  const applyTemplate = (template: HookTemplate) => {
    const merged: HookConfig = {
      PreToolUse: [
        ...(currentHooks?.PreToolUse || []),
        ...(template.config.PreToolUse || []),
      ],
      PostToolUse: [
        ...(currentHooks?.PostToolUse || []),
        ...(template.config.PostToolUse || []),
      ],
    };
    if (merged.PreToolUse?.length === 0) delete merged.PreToolUse;
    if (merged.PostToolUse?.length === 0) delete merged.PostToolUse;
    onApply(merged);
  };

  const clearHooks = () => onApply({});

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
      >
        <span>Hook Templates</span>
        <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-1 gap-2">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t)}
                className="text-left p-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="font-medium text-xs text-gray-800">{t.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
              </button>
            ))}
          </div>
          <button
            onClick={clearHooks}
            className="text-xs text-red-500 hover:text-red-700 mt-2"
          >
            Clear all hooks
          </button>
        </div>
      )}
    </div>
  );
};
