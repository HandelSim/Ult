import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Project, Folder } from '../types';

interface Props {
  project: Project;
  selectedFolder: string | null;
  onSelectFolder: (path: string) => void;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pending: { bg: '#1f2937', border: '#374151', text: '#9ca3af' },
  decomposing: { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  approved: { bg: '#1c3a2a', border: '#22c55e', text: '#86efac' },
  executing: { bg: '#1e3a5f', border: '#6366f1', text: '#a5b4fc' },
  complete: { bg: '#14532d', border: '#22c55e', text: '#86efac' },
  failed: { bg: '#450a0a', border: '#ef4444', text: '#fca5a5' }
};

function buildTree(folders: Folder[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Build a hierarchy
  const byPath = new Map(folders.map(f => [f.path, f]));
  const children = new Map<string, string[]>();
  const roots: string[] = [];

  for (const folder of folders) {
    const parts = folder.path.split('/').filter(Boolean);
    if (parts.length <= 1) {
      roots.push(folder.path);
    } else {
      const parent = parts.slice(0, -1).join('/');
      if (byPath.has(parent)) {
        const ch = children.get(parent) || [];
        ch.push(folder.path);
        children.set(parent, ch);
      } else {
        roots.push(folder.path);
      }
    }
  }

  let xOffset = 0;
  const LEVEL_HEIGHT = 120;
  const NODE_WIDTH = 180;
  const NODE_GAP = 20;

  function placeNode(path: string, depth: number, xStart: number): number {
    const folder = byPath.get(path);
    if (!folder) return xStart;
    const ch = children.get(path) || [];
    let totalWidth = 0;
    let childX = xStart;

    if (ch.length === 0) {
      totalWidth = NODE_WIDTH + NODE_GAP;
    } else {
      for (const c of ch) {
        const w = placeNode(c, depth + 1, childX);
        childX += w;
        totalWidth += w;
      }
    }

    const x = xStart + totalWidth / 2 - NODE_WIDTH / 2;
    const colors = STATUS_COLORS[folder.status] || STATUS_COLORS.pending;

    nodes.push({
      id: path,
      position: { x, y: depth * LEVEL_HEIGHT },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: {
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: '8px 12px',
        width: NODE_WIDTH,
        cursor: 'pointer',
        fontSize: '12px',
        fontFamily: 'Outfit, sans-serif'
      },
      data: {
        label: (
          <div>
            <div style={{ color: colors.text, fontWeight: 600, fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
              {path.split('/').pop() || path}
            </div>
            <div style={{ color: colors.text, opacity: 0.7, fontSize: '10px', marginTop: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {folder.description.slice(0, 30)}
            </div>
            <div style={{
              marginTop: '4px',
              fontSize: '10px',
              color: colors.text,
              opacity: 0.6,
              display: 'flex',
              gap: '4px',
              alignItems: 'center'
            }}>
              <span>{folder.status}</span>
              {folder.cost_usd != null && <span>· ${folder.cost_usd.toFixed(2)}</span>}
            </div>
          </div>
        )
      }
    });

    // Add edge to parent
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join('/');
      if (byPath.has(parentPath)) {
        edges.push({
          id: `${parentPath}->${path}`,
          source: parentPath,
          target: path,
          style: { stroke: '#374151' }
        });
      }
    }

    return totalWidth;
  }

  for (const root of roots) {
    const w = placeNode(root, 0, xOffset);
    xOffset += w + NODE_GAP;
  }

  return { nodes, edges };
}

export function TreeView({ project, selectedFolder, onSelectFolder }: Props) {
  const folders = project.folders || [];
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => buildTree(folders), [folders]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onSelectFolder(node.id);
  }, [onSelectFolder]);

  if (folders.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        <div className="text-center">
          <div className="text-4xl mb-3">🌳</div>
          <p>No folders yet.</p>
          <p className="text-xs mt-1">SMITH will propose a folder tree during decomposition.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes.map(n => ({
          ...n,
          style: {
            ...n.style,
            outline: selectedFolder === n.id ? '2px solid #6366f1' : undefined
          }
        }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-right"
      >
        <Background variant={BackgroundVariant.Dots} color="#1f2937" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
