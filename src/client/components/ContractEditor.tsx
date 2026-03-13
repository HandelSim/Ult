/**
 * ContractEditor - View and edit shared interface contracts between sibling nodes.
 */
import React, { useState } from 'react';
import { Contract } from '../types';

interface ContractEditorProps {
  contracts: Contract[];
  parentNodeId: string;
  onUpdate: (contractId: string, content: string) => Promise<void>;
  onCreate: (name: string, content: string) => Promise<void>;
}

export const ContractEditor: React.FC<ContractEditorProps> = ({
  contracts,
  parentNodeId: _parentNodeId,
  onUpdate,
  onCreate,
}) => {
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');

  const selectContract = (contract: Contract) => {
    setSelectedContract(contract);
    setEditContent(contract.content || '');
  };

  const handleSave = async () => {
    if (!selectedContract) return;
    setSaving(true);
    try {
      await onUpdate(selectedContract.id, editContent);
      setSelectedContract(prev => prev ? { ...prev, content: editContent } : null);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await onCreate(newName.trim(), newContent);
      setShowCreate(false);
      setNewName('');
      setNewContent('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Contract list */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Contracts ({contracts.length})</h4>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          + New Contract
        </button>
      </div>

      {/* New contract form */}
      {showCreate && (
        <div className="p-3 border border-dashed border-blue-300 rounded-lg space-y-2 bg-blue-50">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Contract name (e.g., api-types)"
            className="w-full text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Initial content (TypeScript interface, API spec, etc.)"
            rows={4}
            className="w-full text-xs font-mono px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} className="text-xs text-gray-600 px-3 py-1 rounded hover:bg-gray-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Contract list */}
      {contracts.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No contracts defined. Contracts are created during decomposition.</p>
      ) : (
        <div className="space-y-1">
          {contracts.map(contract => (
            <button
              key={contract.id}
              onClick={() => selectContract(contract)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                selectedContract?.id === contract.id
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'hover:bg-gray-100 text-gray-700 border border-transparent'
              }`}
            >
              <div className="font-medium">{contract.name}</div>
              <div className="text-xs text-gray-500 truncate">
                {contract.content?.substring(0, 60) || '(empty)'}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Contract editor */}
      {selectedContract && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-medium text-gray-700">{selectedContract.name}</span>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || editContent === selectedContract.content}
                className="text-xs bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setSelectedContract(null)} className="text-xs text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
          </div>
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            rows={8}
            className="w-full p-3 text-xs font-mono border-none outline-none resize-y"
            placeholder="Contract content (TypeScript interfaces, API specs, etc.)"
          />
        </div>
      )}
    </div>
  );
};
