'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { FileText, Plus, ChevronRight, GripVertical } from 'lucide-react';
import type { PageTreeItem } from '@/lib/types';

interface TreeNode {
  id: string;
  title: string;
  icon: string;
  children: TreeNode[];
  depth: number;
  parent_id: string | null;
}

interface PageTreeViewProps {
  pages: PageTreeItem[];
  decryptedTitles: Record<string, string>;
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  onCreatePage: (parentId?: string) => void;
  onRenameStart?: (pageId: string, title: string) => void;
}

function buildTree(pages: PageTreeItem[], titles: Record<string, string>): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const p of pages) {
    map.set(p.id, { id: p.id, title: titles[p.id] || 'Untitled', icon: p.icon || '', children: [], depth: 0, parent_id: p.parent_id });
  }

  for (const p of pages) {
    const node = map.get(p.id)!;
    if (p.parent_id && map.has(p.parent_id)) {
      const parent = map.get(p.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function TreeNodeCard({
  node, onSelect, activeId, onCreateChild, onRename, collapsed, onToggle,
}: {
  node: TreeNode;
  onSelect: (id: string) => void;
  activeId: string | null;
  onCreateChild: (parentId: string) => void;
  onRename?: (id: string, title: string) => void;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const isActive = node.id === activeId;
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(node.title);
    setEditing(true);
  };

  const handleRenameSubmit = () => {
    setEditing(false);
    if (editValue.trim() && editValue !== node.title) {
      onRename?.(node.id, editValue.trim());
    }
  };

  return (
    <div className="tree-branch">
      <div
        className={`tree-node group ${isActive ? 'tree-node-active' : ''}`}
        onClick={() => onSelect(node.id)}
        onDoubleClick={handleDoubleClick}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {hasChildren ? (
            <button onClick={e => { e.stopPropagation(); onToggle(node.id); }} className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 flex-shrink-0 transition">
              <ChevronRight size={14} className={`transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="w-[18px] flex-shrink-0" />
          )}
          <span className="text-lg flex-shrink-0 leading-none">{node.icon || '📄'}</span>
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={e => { if (e.key === 'Enter') handleRenameSubmit(); if (e.key === 'Escape') setEditing(false); }}
              className="flex-1 min-w-0 bg-white dark:bg-neutral-800 border border-violet-400 rounded px-1.5 py-0.5 text-sm outline-none"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="truncate text-sm font-medium">{node.title}</span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onCreateChild(node.id); }}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-neutral-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
          title="Add sub-page"
        >
          <Plus size={14} />
        </button>
      </div>

      {hasChildren && !isCollapsed && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeNodeCard
              key={child.id} node={child} onSelect={onSelect} activeId={activeId}
              onCreateChild={onCreateChild} onRename={onRename}
              collapsed={collapsed} onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PageTreeView({ pages, decryptedTitles, activePageId, onSelectPage, onCreatePage, onRenameStart }: PageTreeViewProps) {
  const tree = buildTree(pages, decryptedTitles);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="h-full flex flex-col bg-neutral-50/50 dark:bg-[#1c1c1c] overflow-auto">
      <div className="max-w-[720px] w-full mx-auto flex flex-col flex-1 px-6 py-8 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <FileText size={16} className="text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-neutral-800 dark:text-neutral-200">Page Overview</h2>
              <p className="text-[11px] text-neutral-400">{pages.length} pages</p>
            </div>
          </div>
          <button
            onClick={() => onCreatePage()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[13px] font-medium transition"
          >
            <Plus size={14} /> New Page
          </button>
        </div>

        {/* Tree */}
        <div className="flex-1">
          {tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center pt-16">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
                <FileText size={28} className="text-neutral-300 dark:text-neutral-600" />
              </div>
              <p className="text-[15px] text-neutral-500 mb-2">No pages yet</p>
              <p className="text-[13px] text-neutral-400 mb-4">Create your first page to get started</p>
              <button onClick={() => onCreatePage()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[13px] font-medium transition">
                <Plus size={14} /> Create Page
              </button>
            </div>
          ) : (
            <div className="tree-root">
              {tree.map(node => (
                <TreeNodeCard
                  key={node.id} node={node} onSelect={onSelectPage}
                  activeId={activePageId} onCreateChild={onCreatePage}
                  onRename={onRenameStart} collapsed={collapsed} onToggle={toggleCollapse}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
