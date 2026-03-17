'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { decrypt } from '@/lib/crypto';
import { api } from '@/lib/api';
import type { PageTreeItem, Workspace } from '@/lib/types';
import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher';
import {
  Plus, Search, FileText, ChevronRight, ChevronDown,
  Trash2, LogOut, HelpCircle, Save,
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
}

export default function Sidebar({
  pages, activePageId, onSelectPage, onCreatePage,
  onDeletePage, onOpenSearch, onOpenTrash, onOpenTips, collapsed,
  onSwitchWorkspace, onOpenWorkspaceSettings, onCreateWorkspace,
  currentWorkspaceId,
}: SidebarProps) {
  const { email, displayName, logout, encKey } = useAuth();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

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
    const title = decryptTitle(page.title);

    return (
      <div key={page.id}>
        <div
          className={`group flex items-center gap-1 py-1 px-2 mx-1 rounded-lg cursor-pointer transition-colors duration-200 text-sm ${
            isActive
              ? 'bg-blue-50/70 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/70 dark:hover:bg-neutral-800'
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
          <span className="truncate flex-1 ml-1">{title}</span>

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
    <div className="w-[260px] h-full flex flex-col bg-[#f8f8f7] dark:bg-[#1a1a1a] border-r border-neutral-200/70 dark:border-neutral-800 flex-shrink-0">
      {/* Workspace Switcher */}
      <div className="p-3 border-b border-neutral-200/70 dark:border-neutral-800">
        <WorkspaceSwitcher
          currentWorkspaceId={currentWorkspaceId}
          onSwitch={onSwitchWorkspace}
          onOpenSettings={onOpenWorkspaceSettings}
          onCreateWorkspace={onCreateWorkspace}
        />
      </div>

      {/* Actions */}
      <div className="p-2 space-y-0.5">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100/70 dark:hover:bg-neutral-800 transition-colors duration-200"
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
      <div className="p-2 border-t border-neutral-200/70 dark:border-neutral-800 space-y-0.5">
        <button onClick={onOpenTrash} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100/70 dark:hover:bg-neutral-800 transition-colors duration-200">
          <Trash2 size={16} /><span>Trash</span>
        </button>
        <button onClick={onOpenTips} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100/70 dark:hover:bg-neutral-800 transition-colors duration-200">
          <HelpCircle size={16} /><span>Help & Guide</span>
        </button>

        {/* User account - combined profile + logout */}
        <div className="relative">
          <button
            onClick={openUserMenu}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100/70 dark:hover:bg-neutral-800 transition-colors duration-200"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
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
                      className="flex-1 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-800 dark:text-neutral-200 outline-none focus:border-blue-500"
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
