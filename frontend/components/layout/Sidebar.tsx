'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { PageTreeItem, Workspace, SharedPageItem } from '@/lib/types';
import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher';
import {
  Plus, Search, FileText, ChevronRight, ChevronDown,
  Trash2, LogOut, HelpCircle, Save, Share2, Eye, Edit3,
} from 'lucide-react';

interface SidebarProps {
  pages: PageTreeItem[];
  activePageId: string | null;
  onSelectPage: (id: string) => void;
  onCreatePage: (parentId?: string) => void;
  onDeletePage: (id: string) => void;
  onOpenSearch: () => void;
  onOpenTrash: () => void;
  onOpenTips: () => void;
  onSwitchWorkspace: (workspace: Workspace) => void;
  onOpenWorkspaceSettings: (workspace: Workspace) => void;
  onCreateWorkspace: () => void;
  currentWorkspaceId: string;
  collapsed: boolean;
  onOpenSharedPage?: (pageId: string) => void;
  decryptedTitles?: Record<string, string>;
}

export default function Sidebar({
  pages, activePageId, onSelectPage, onCreatePage,
  onDeletePage, onOpenSearch, onOpenTrash, onOpenTips, collapsed,
  onSwitchWorkspace, onOpenWorkspaceSettings, onCreateWorkspace,
  currentWorkspaceId, onOpenSharedPage, decryptedTitles = {},
}: SidebarProps) {
  const { email, displayName, logout } = useAuth();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [sharedPages, setSharedPages] = useState<SharedPageItem[]>([]);
  const [sharedExpanded, setSharedExpanded] = useState(true);

  useEffect(() => {
    api.get<SharedPageItem[]>('/shared-pages')
      .then(setSharedPages)
      .catch(() => {});
  }, [currentWorkspaceId]);

  if (collapsed) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const decryptTitle = (pageId: string) => {
    return decryptedTitles[pageId] || 'Untitled';
  };

  const rootPages = pages.filter(p => !p.parent_id);
  const childrenOf = (parentId: string) => pages.filter(p => p.parent_id === parentId);

  const openUserMenu = () => {
    setEditDisplayName(displayName || '');
    setUserMenuOpen(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/me', { display_name: editDisplayName });
    } catch { /* ignore */ }
    setSaving(false);
  };

  const renderPageItem = (page: PageTreeItem, depth: number = 0) => {
    const isActive = page.id === activePageId;
    const isExpanded = expandedIds.has(page.id);
    const children = childrenOf(page.id);
    const isHovered = hoveredId === page.id;
    const title = decryptTitle(page.id);

    return (
      <div key={page.id}>
        <div
          className={`group flex items-center gap-2.5 py-2 px-3 mx-3 rounded-lg cursor-pointer transition-colors duration-200 text-[14px] ${
            isActive
              ? 'bg-blue-50/80 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
              : 'text-neutral-700 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800'
          }`}
          style={{ paddingLeft: `${depth * 20 + 10}px` }}
          onClick={() => onSelectPage(page.id)}
          onMouseEnter={() => setHoveredId(page.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {children.length > 0 || page.has_children ? (
            <button
              onClick={e => { e.stopPropagation(); toggleExpand(page.id); }}
              className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 flex-shrink-0"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span className="w-5 flex-shrink-0" />
          )}

          <span className="flex-shrink-0 text-lg leading-none">{page.icon || ''}</span>
          <span className="truncate flex-1">{title}</span>

          {isHovered && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={e => { e.stopPropagation(); onDeletePage(page.id); }}
                className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500 transition"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onCreatePage(page.id); }}
                className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-blue-500 transition"
              >
                <Plus size={15} />
              </button>
            </div>
          )}
        </div>

        {isExpanded && children.map(child => renderPageItem(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="w-[260px] h-full flex flex-col bg-[#f8f8f7] dark:bg-[#1a1a1a] border-r border-neutral-200/50 dark:border-neutral-800 flex-shrink-0">
      {/* Workspace Switcher */}
      <div className="px-5 py-4 border-b border-neutral-200/50 dark:border-neutral-800">
        <WorkspaceSwitcher
          currentWorkspaceId={currentWorkspaceId}
          onSwitch={onSwitchWorkspace}
          onOpenSettings={onOpenWorkspaceSettings}
          onCreateWorkspace={onCreateWorkspace}
        />
      </div>

      {/* Actions */}
      <div className="px-4 py-3 space-y-1">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800 transition-colors duration-200"
        >
          <Search size={18} />
          <span>Search</span>
          <kbd className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-neutral-200/80 dark:bg-neutral-700 text-neutral-400 font-mono">Ctrl+K</kbd>
        </button>
      </div>

      {/* Pages Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-2">
        <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Pages</span>
        <button
          onClick={() => onCreatePage()}
          className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Page Tree */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {rootPages.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <FileText size={36} className="mx-auto mb-4 text-neutral-300 dark:text-neutral-600" />
            <p className="text-[14px] text-neutral-400 dark:text-neutral-500">No pages yet</p>
            <button
              onClick={() => onCreatePage()}
              className="mt-3 text-[14px] text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first page
            </button>
          </div>
        ) : (
          rootPages.map(page => renderPageItem(page))
        )}

        {/* Shared with me */}
        {sharedPages.length > 0 && (
          <>
            <div className="flex items-center justify-between px-6 pt-5 pb-2">
              <button
                onClick={() => setSharedExpanded(!sharedExpanded)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider hover:text-neutral-600 dark:hover:text-neutral-300 transition"
              >
                {sharedExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <Share2 size={13} />
                Shared with me
              </button>
            </div>
            {sharedExpanded && sharedPages.map(sp => (
              <div key={sp.id}>
                <div
                  className={`group flex items-center gap-2.5 py-2 px-3 mx-3 rounded-lg cursor-pointer transition-colors duration-200 text-[14px] ${
                    activePageId === sp.id
                      ? 'bg-blue-50/80 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'text-neutral-700 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800'
                  }`}
                  style={{ paddingLeft: '10px' }}
                  onClick={() => onOpenSharedPage?.(sp.id)}
                >
                  <span className="w-5 flex-shrink-0" />
                  <span className="flex-shrink-0 text-lg leading-none">{sp.icon || ''}</span>
                  <span className="truncate flex-1">
                    {sp.shared_by_email ? `From ${sp.shared_by_email}` : 'Shared page'}
                  </span>
                  {sp.permission === 'view' ? (
                    <Eye size={13} className="text-neutral-400 flex-shrink-0" />
                  ) : (
                    <Edit3 size={13} className="text-neutral-400 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-neutral-200/50 dark:border-neutral-800 space-y-0.5">
        <button onClick={onOpenTrash} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800 transition-colors duration-200">
          <Trash2 size={18} /><span>Trash</span>
        </button>
        <button onClick={onOpenTips} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800 transition-colors duration-200">
          <HelpCircle size={18} /><span>Help & Guide</span>
        </button>

        {/* User account - combined profile + logout */}
        <div className="relative">
          <button
            onClick={openUserMenu}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800 transition-colors duration-200"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {(displayName || email || '?').charAt(0).toUpperCase()}
            </div>
            <span className="truncate">{displayName || email}</span>
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute left-0 bottom-full mb-1 w-64 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden">
                {/* Email */}
                <div className="px-4 pt-3 pb-2 border-b border-neutral-100 dark:border-neutral-700">
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-0.5">Account</p>
                  <p className="text-sm text-neutral-800 dark:text-neutral-200 truncate">{email}</p>
                </div>

                {/* Display name edit */}
                <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
                  <label className="text-[11px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wider block mb-1">Display Name</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={editDisplayName}
                      onChange={e => setEditDisplayName(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-800 dark:text-neutral-200 outline-none focus:border-blue-500"
                      placeholder="Display name"
                    />
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition disabled:opacity-50"
                    >
                      <Save size={12} />
                    </button>
                  </div>
                </div>

                {/* Sign out */}
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
