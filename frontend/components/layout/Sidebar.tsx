'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { api } from '@/lib/api';
import { unwrapPageKey, decrypt } from '@/lib/crypto';
import type { PageTreeItem, Workspace, SharedPageItem } from '@/lib/types';
import WorkspaceSwitcher from '@/components/workspace/WorkspaceSwitcher';
import {
  Plus, Search, FileText, ChevronRight, ChevronDown,
  Trash2, LogOut, HelpCircle, Save, Users,
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
  const { email, displayName, logout, privateKey } = useAuth();
  const { t } = useLanguage();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [sharedPages, setSharedPages] = useState<SharedPageItem[]>([]);
  const [sharedTitles, setSharedTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<SharedPageItem[]>('/shared-pages').then(async (pages) => {
      setSharedPages(pages);
      if (!privateKey) return;
      const titles: Record<string, string> = {};
      await Promise.allSettled(pages.map(async (sp) => {
        if (!sp.page_key_grant) return;
        try {
          const pageKey = await unwrapPageKey(sp.page_key_grant, privateKey);
          titles[sp.id] = sp.title ? await decrypt(sp.title, pageKey) : '';
        } catch { /* leave as empty */ }
      }));
      setSharedTitles(titles);
    }).catch(() => {});
  }, [currentWorkspaceId, privateKey]);

  if (collapsed) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const decryptTitle = (pageId: string) => decryptedTitles[pageId] || t.untitled;
  const rootPages = pages.filter(p => !p.parent_id);
  const childrenOf = (parentId: string) => pages.filter(p => p.parent_id === parentId);

  const openUserMenu = () => { setEditDisplayName(displayName || ''); setUserMenuOpen(true); };
  const handleSaveProfile = async () => {
    setSaving(true);
    try { await api.put('/me', { display_name: editDisplayName }); } catch {}
    setSaving(false);
  };

  const renderPageItem = (page: PageTreeItem, depth: number = 0) => {
    const isActive = page.id === activePageId;
    const isExpanded = expandedIds.has(page.id);
    const children = childrenOf(page.id);
    const hasChildren = children.length > 0 || page.has_children;
    const isHovered = hoveredId === page.id;
    const title = decryptTitle(page.id);

    return (
      <div key={page.id}>
        <div
          className={`group relative flex items-center gap-1.5 py-1.5 pr-1.5 mx-2 rounded-[7px] cursor-pointer transition-colors duration-150 text-[13.5px] font-medium ${
            isActive
              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]'
          }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => onSelectPage(page.id)}
          onMouseEnter={() => setHoveredId(page.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {hasChildren ? (
            <button
              onClick={e => { e.stopPropagation(); toggleExpand(page.id); }}
              className="p-0.5 rounded hover:bg-[var(--bg-hover-strong)] flex-shrink-0 transition-colors"
            >
              {isExpanded
                ? <ChevronDown size={14} className="opacity-60" />
                : <ChevronRight size={14} className="opacity-60" />}
            </button>
          ) : (
            <span className="w-[18px] flex-shrink-0" />
          )}
          <span className="flex-shrink-0 text-[15px] leading-none w-[18px] text-center">
            {page.icon || <FileText size={14} className="inline opacity-50" />}
          </span>
          <span className="truncate flex-1">{title}</span>
          {isHovered && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={e => { e.stopPropagation(); onDeletePage(page.id); }}
                className="p-1 rounded-[5px] hover:bg-red-50 dark:hover:bg-red-500/15 text-[var(--fg-tertiary)] hover:text-red-500 transition-colors"
                title={t.blockMenuDelete}
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onCreatePage(page.id); }}
                className="p-1 rounded-[5px] hover:bg-[var(--bg-hover-strong)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
                title={t.createFirstPage}
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
    <aside className="w-[264px] h-full flex flex-col bg-[var(--bg-surface-2)] border-r border-[var(--border-subtle)] flex-shrink-0">
      {/* Workspace Switcher */}
      <div className="px-3 pt-3 pb-2">
        <WorkspaceSwitcher
          currentWorkspaceId={currentWorkspaceId}
          onSwitch={onSwitchWorkspace}
          onOpenSettings={onOpenWorkspaceSettings}
          onCreateWorkspace={onCreateWorkspace}
        />
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-[13px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors duration-150 border border-transparent hover:border-[var(--border-default)]"
        >
          <Search size={15} className="opacity-70" />
          <span>{t.search}</span>
          <kbd className="ml-auto sc-kbd !py-[1px] !px-[5px] !text-[10px]">Ctrl K</kbd>
        </button>
      </div>

      {/* ═══ My Pages ═══ */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-5 pt-2 pb-1">
          <span className="text-[10.5px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-[0.08em]">
            {t.myPages}
          </span>
          <button
            onClick={() => onCreatePage()}
            className="p-1 rounded-[5px] hover:bg-[var(--bg-hover-strong)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
            title={t.createFirstPage}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-1">
          {rootPages.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="mx-auto mb-3 w-10 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center">
                <FileText size={18} className="text-[var(--fg-tertiary)]" />
              </div>
              <p className="text-[12px] text-[var(--fg-tertiary)] mb-2">{t.noPagesYet}</p>
              <button
                onClick={() => onCreatePage()}
                className="inline-flex items-center gap-1 text-[12.5px] text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition-colors"
              >
                <Plus size={12} /> {t.createFirstPage}
              </button>
            </div>
          ) : (
            rootPages.map(page => renderPageItem(page))
          )}
        </div>
      </div>

      {/* ═══ Shared With Me ═══ */}
      <div
        className="border-t border-[var(--border-subtle)] flex flex-col"
        style={{ minHeight: '120px', maxHeight: '36%' }}
      >
        <div className="flex items-center gap-1.5 px-5 pt-3 pb-1">
          <Users size={11} className="text-[var(--fg-tertiary)]" />
          <span className="text-[10.5px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-[0.08em]">
            {t.sharedWithMe}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto pb-1">
          {sharedPages.length === 0 ? (
            <div className="px-5 py-3 text-center">
              <p className="text-[11.5px] text-[var(--fg-tertiary)]">{t.noSharedPages}</p>
            </div>
          ) : (
            sharedPages.map(sp => (
              <div
                key={sp.id}
                className={`flex items-center gap-2 py-1.5 px-2.5 mx-2 rounded-[7px] cursor-pointer transition-colors duration-150 ${
                  activePageId === sp.id
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]'
                }`}
                onClick={() => onOpenSharedPage?.(sp.id)}
              >
                <span className="flex-shrink-0 text-[14px] leading-none w-[16px] text-center">
                  {sp.icon || '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[12.5px] font-medium">{sharedTitles[sp.id] || t.untitled}</p>
                  {sp.shared_by_email && (
                    <p className="truncate text-[10.5px] text-[var(--fg-tertiary)] mt-0.5">{sp.shared_by_email}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-[var(--border-subtle)]">
        <button
          onClick={onOpenTrash}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] text-[13px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors duration-150"
        >
          <Trash2 size={15} className="opacity-70" />
          <span>{t.trash}</span>
        </button>
        <button
          onClick={onOpenTips}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] text-[13px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors duration-150"
        >
          <HelpCircle size={15} className="opacity-70" />
          <span>{t.help}</span>
        </button>

        {/* User menu */}
        <div className="relative mt-1 pt-2 border-t border-[var(--border-subtle)]">
          <button
            onClick={openUserMenu}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[8px] text-[13px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors duration-150"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--brand-500,#8b5cf6)] to-[var(--brand-700,#6d28d9)] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 shadow-[var(--shadow-xs)]">
              {(displayName || email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="truncate text-[12.5px] font-medium text-[var(--fg-primary)]">{displayName || email}</p>
              {displayName && <p className="truncate text-[10.5px] text-[var(--fg-tertiary)]">{email}</p>}
            </div>
          </button>
          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute left-0 bottom-full mb-2 w-[260px] bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] shadow-[var(--shadow-lg)] z-50 overflow-hidden animate-scale-in origin-bottom-left">
                <div className="px-4 pt-3 pb-2.5 border-b border-[var(--border-subtle)]">
                  <p className="text-[10px] text-[var(--fg-tertiary)] uppercase tracking-[0.08em] font-semibold mb-1">{t.account}</p>
                  <p className="text-[13px] text-[var(--fg-primary)] truncate font-medium">{email}</p>
                </div>
                <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                  <label className="text-[10px] text-[var(--fg-tertiary)] uppercase tracking-[0.08em] font-semibold block mb-1.5">
                    {t.displayName}
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={editDisplayName}
                      onChange={e => setEditDisplayName(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface-2)] text-[13px] text-[var(--fg-primary)] outline-none focus:border-[var(--accent)] focus:shadow-[var(--shadow-focus)] transition-shadow"
                      placeholder={t.displayNamePlaceholder}
                    />
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="px-2.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50 flex items-center justify-center"
                      title={t.saveChanges}
                    >
                      <Save size={13} />
                    </button>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors font-medium"
                >
                  <LogOut size={14} /> {t.signOut}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
