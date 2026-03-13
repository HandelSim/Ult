/**
 * StatusBadge - Visual indicator for node execution status.
 * Color-coded with appropriate icons for quick scanning.
 */
import React from 'react';
import { NodeStatus, NodeType } from '../types';

interface StatusBadgeProps {
  status: NodeStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<NodeStatus, { label: string; classes: string; dot: string }> = {
  pending:     { label: 'Pending',      classes: 'bg-gray-100 text-gray-700 border-gray-300',     dot: 'bg-gray-400' },
  approved:    { label: 'Approved',     classes: 'bg-blue-100 text-blue-700 border-blue-300',     dot: 'bg-blue-500' },
  decomposing: { label: 'Decomposing',  classes: 'bg-yellow-100 text-yellow-700 border-yellow-300', dot: 'bg-yellow-500 animate-pulse' },
  running:     { label: 'Running',      classes: 'bg-emerald-100 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500 animate-pulse' },
  completed:   { label: 'Completed',    classes: 'bg-green-100 text-green-700 border-green-300',  dot: 'bg-green-500' },
  failed:      { label: 'Failed',       classes: 'bg-red-100 text-red-700 border-red-300',        dot: 'bg-red-500' },
  rejected:    { label: 'Rejected',     classes: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5 gap-1'
    : 'text-xs px-2 py-1 gap-1.5';

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${sizeClasses} ${config.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  );
};

interface TypeBadgeProps {
  type: NodeType;
}

const TYPE_CONFIG: Record<NodeType, { label: string; classes: string }> = {
  orchestrator: { label: 'Orchestrator', classes: 'bg-violet-100 text-violet-700 border-violet-300' },
  leaf:         { label: 'Leaf',         classes: 'bg-sky-100 text-sky-700 border-sky-300' },
  test:         { label: 'Test',         classes: 'bg-amber-100 text-amber-700 border-amber-300' },
};

export const TypeBadge: React.FC<TypeBadgeProps> = ({ type }) => {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.leaf;
  return (
    <span className={`inline-flex items-center rounded border text-xs px-1.5 py-0.5 font-medium ${config.classes}`}>
      {config.label}
    </span>
  );
};
