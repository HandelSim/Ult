/**
 * PromptEditor - Textarea for editing node prompts with character count.
 */
import React from 'react';

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  readOnly?: boolean;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter prompt...',
  rows = 6,
  label = 'Prompt',
  readOnly = false,
}) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-400">{label}</label>
        <span className="text-xs text-gray-500">{value.length} chars</span>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        readOnly={readOnly}
        className={`
          w-full px-3 py-2 text-sm font-mono border border-gray-600 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          resize-y transition-colors placeholder-gray-600
          ${readOnly ? 'bg-gray-800 text-gray-400 cursor-default' : 'bg-gray-700 text-gray-100'}
        `}
      />
    </div>
  );
};
