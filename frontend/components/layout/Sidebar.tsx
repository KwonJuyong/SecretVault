'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { decrypt } from '@/lib/crypto';
import type { PageTreeItem } from '@/lib/types';
import {
  Plus, Search, FileText, ChevronRight, ChevronDown,
  Trash2, Settings, LogOut, User, MoreHorizontal,
} from 'lucide-react';

interface SidebarProps {
  pages: PageTreeItem[];
  activePageId: string | null;
  onSelectPage: (id: string) => void;
  onCreatePage: (parentId?: string) => void;
  onDeletePage: (id: string) => void;
  onOpenSearch: () => void;
  onOpenTrash: () => void;
  collapsed: boolean;
}

export default function Sidebar({
  pages, activePageId, onSelectPage, onCreatePage,
  onDeletePage, onOpenSearch, onOpenTrash, collapsed,
}: SidebarProps) {
  const { userId, displayName, logout, encKey } = useAuth();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [profileOpen, setProfileOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (collapsed) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const decryptTitle = (encrypted: string) => {
    const decrypted = decrypt(encrypted, encKey);
    return decrypted || 'Untitled';
  };

  // Build tree from flat list
  const rootPages = pages.filter(p => !p.parent_id);
  const childrenOf = (parentId: string) => pages.filter(p => p.parent_id === parentId);

  const renderPageItem = (page: PageTreeItem, depth: number = 0) => {
    const isActive = page.id === activePageId;
    const isExpanded = expandedIds.has(page.id);
    const children = childrenOf(page.id);
    const isHovered = hoveredId === page.id;
    const title = decryptTitle(page.title);

    return (
      <div key={page.id}>
        <div
          className={`group flex items-center gap-1 py-1 px-2 mx-1 rounded-lg cursor-pointer transition-colors text-sm ${
            isActive
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => onSelectPage(page.id)}
          onMouseEnter={() => setHoveredId(page.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {children.length > 0 || page.has_children ? (
            <button
              onClick={e => { e.stopPropagation(); toggleExpand(page.id); }}
              className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 flex-shrink-0"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-5 flex-shrink-0" />
          )}

          <span className="flex-shrink-0 text-base">{page.icon || ''}</span>

          <span className="truncate flex-1 ml-1">
            {title}
          </span>

          {isHovered && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={e => { e.stopPropagation(); onDeletePage(page.id); }}
                className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onCreatePage(page.id); }}
                className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-blue-500"
              >
                <Plus size={13} />
              </button>
            </div>
          )}
        </div>

        {isExpanded && children.map(child => renderPageItem(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="w-[260px] h-full flex flex-col bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex-shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {(displayName || userId).charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
              {displayName || userId}
            </span>
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden">
                <div className="p-3 border-b border-neutral-100 dark:border-neutral-700">
                  <p className="text-xs text-neutral-500">Signed in as</p>
                  <p className="text-sm font-semibold text-neutral-800 dark:text-white">{userId}</p>
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-2 space-y-0.5">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
        >
          <Search size={16} />
          <span>Search</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-400 font-mono">Ctrl+K</kbd>
        </button>
      </div>

      {/* Pages Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Pages</span>
        <button
          onClick={() => onCreatePage()}
          className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Page Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {rootPages.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <FileText size={32} className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
            <p className="text-sm text-neutral-400 dark:text-neutral-500">No pages yet</p>
            <button
              onClick={() => onCreatePage()}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first page
            </button>
          </div>
        ) : (
          rootPages.map(page => renderPageItem(page))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-neutral-200 dark:border-neutral-800">
        <button
          onClick={onOpenTrash}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
        >
          <Trash2 size={16} />
          <span>Trash</span>
        </button>
      </div>
    </div>
  );
}
