'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { FileText, Plus, ChevronRight, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
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
    map.set(p.id, {
      id: p.id,
      title: titles[p.id] || 'Untitled',
      icon: p.icon || '',
      children: [],
      depth: 0,
      parent_id: p.parent_id,
    });
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
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {hasChildren ? (
            <button
              onClick={e => { e.stopPropagation(); onToggle(node.id); }}
              className="p-0.5 rounded hover:bg-[var(--bg-hover-strong)] flex-shrink-0 transition-colors"
            >
              <ChevronRight
                size={14}
                className={`transition-transform text-[var(--fg-tertiary)] ${!isCollapsed ? 'rotate-90' : ''}`}
              />
            </button>
          ) : (
            <span className="w-[18px] flex-shrink-0" />
          )}
          <span className="text-[17px] flex-shrink-0 leading-none">{node.icon || '📄'}</span>
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={e => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="flex-1 min-w-0 bg-[var(--bg-surface)] border border-[var(--accent)] rounded-md px-2 py-0.5 text-[13.5px] outline-none focus:shadow-[var(--shadow-focus)]"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="truncate text-[13.5px] font-medium">{node.title}</span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onCreateChild(node.id); }}
          className="p-1.5 rounded-md hover:bg-[var(--bg-hover-strong)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] opacity-0 group-hover:opacity-100 transition flex-shrink-0"
          title="Add sub-page"
        >
          <Plus size={14} />
        </button>
      </div>

      {hasChildren && !isCollapsed && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeNodeCard
              key={child.id}
              node={child}
              onSelect={onSelect}
              activeId={activeId}
              onCreateChild={onCreateChild}
              onRename={onRename}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PageTreeView({
  pages, decryptedTitles, activePageId, onSelectPage, onCreatePage, onRenameStart,
}: PageTreeViewProps) {
  const { t } = useLanguage();
  const tree = buildTree(pages, decryptedTitles);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const rootCount = tree.length;
  const totalCount = pages.length;

  return (
    <div className="h-full flex flex-col bg-[var(--bg-app)] overflow-auto">
      <div className="max-w-[760px] w-full mx-auto flex flex-col flex-1 px-8 py-12 min-h-0">
        {/* Hero Header */}
        <div className="mb-10 animate-slide-up">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-[11px] font-semibold mb-3">
                <Sparkles size={11} /> WORKSPACE
              </div>
              <h1 className="text-[32px] font-bold tracking-tight text-[var(--fg-primary)] mb-1.5">
                Your pages
              </h1>
              <p className="text-[14px] text-[var(--fg-secondary)]">
                {totalCount === 0
                  ? 'Start a new page to capture your ideas.'
                  : `${totalCount} page${totalCount === 1 ? '' : 's'} · ${rootCount} root`}
              </p>
            </div>
            <button
              onClick={() => onCreatePage()}
              className="flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-semibold transition-colors shadow-[var(--shadow-sm)] flex-shrink-0"
            >
              <Plus size={15} /> New page
            </button>
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1">
          {tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface-2)] border border-[var(--border-default)] flex items-center justify-center mb-5 shadow-[var(--shadow-xs)]">
                <FileText size={26} className="text-[var(--fg-tertiary)]" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--fg-primary)] mb-1">{t.noPagesYet}</p>
              <p className="text-[13px] text-[var(--fg-tertiary)] mb-5">
                {t.noPagesYetSearch || 'Start from scratch or use a /-command inside a page.'}
              </p>
              <button
                onClick={() => onCreatePage()}
                className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-semibold transition-colors shadow-[var(--shadow-sm)]"
              >
                <Plus size={14} /> {t.createFirstPage}
              </button>
            </div>
          ) : (
            <div className="tree-root animate-fade-in">
              {tree.map(node => (
                <TreeNodeCard
                  key={node.id}
                  node={node}
                  onSelect={onSelectPage}
                  activeId={activePageId}
                  onCreateChild={onCreatePage}
                  onRename={onRenameStart}
                  collapsed={collapsed}
                  onToggle={toggleCollapse}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
