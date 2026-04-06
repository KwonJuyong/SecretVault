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
  Trash2, LogOut, HelpCircle, Save, Share2, Users,
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
  const handleSaveProfile = async () => { setSaving(true); try { await api.put('/me', { display_name: editDisplayName }); } catch {} setSaving(false); };

  const renderPageItem = (page: PageTreeItem, depth: number = 0) => {
    const isActive = page.id === activePageId;
    const isExpanded = expandedIds.has(page.id);
    const children = childrenOf(page.id);
    const isHovered = hoveredId === page.id;
    const title = decryptTitle(page.id);

    return (
      <div key={page.id}>
        <div
          className={`group flex items-center gap-2 py-[9px] px-2.5 mx-2 rounded-lg cursor-pointer transition-colors text-[14px] ${
            isActive
              ? 'bg-violet-50/80 dark:bg-violet-900/20 text-violet-500 dark:text-violet-300'
              : 'text-neutral-700 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800'
          }`}
          style={{ paddingLeft: `${depth * 18 + 8}px` }}
          onClick={() => onSelectPage(page.id)}
          onMouseEnter={() => setHoveredId(page.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {children.length > 0 || page.has_children ? (
            <button onClick={e => { e.stopPropagation(); toggleExpand(page.id); }} className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 flex-shrink-0">
              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : (<span className="w-5 flex-shrink-0" />)}
          <span className="flex-shrink-0 text-base leading-none">{page.icon || ''}</span>
          <span className="truncate flex-1">{title}</span>
          {isHovered && (
            <div className="flex items-center gap-0 flex-shrink-0">
              <button onClick={e => { e.stopPropagation(); onDeletePage(page.id); }} className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
              <button onClick={e => { e.stopPropagation(); onCreatePage(page.id); }} className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 transition"><Plus size={14} /></button>
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
      <div className="px-4 py-3 border-b border-neutral-200/50 dark:border-neutral-800">
        <WorkspaceSwitcher currentWorkspaceId={currentWorkspaceId} onSwitch={onSwitchWorkspace} onOpenSettings={onOpenWorkspaceSettings} onCreateWorkspace={onCreateWorkspace} />
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <button onClick={onOpenSearch} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800 transition">
          <Search size={17} /><span>{t.search}</span>
          <kbd className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-neutral-200/80 dark:bg-neutral-700 text-neutral-400 font-mono">Ctrl+K</kbd>
        </button>
      </div>

      {/* ═══ TOP: My Pages ═══ */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-5 pt-3 pb-1.5">
          <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{t.myPages}</span>
          <button onClick={() => onCreatePage()} className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition">
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-1">
          {rootPages.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <FileText size={28} className="mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
              <p className="text-[13px] text-neutral-400">{t.noPagesYet}</p>
              <button onClick={() => onCreatePage()} className="mt-2 text-[13px] text-violet-500 hover:text-violet-500 font-medium">{t.createFirstPage}</button>
            </div>
          ) : (
            rootPages.map(page => renderPageItem(page))
          )}
        </div>
      </div>

      {/* ═══ BOTTOM: Shared / Workspace ═══ */}
      <div className="border-t border-neutral-200/50 dark:border-neutral-800 flex flex-col" style={{ minHeight: '120px', maxHeight: '40%' }}>
        <div className="flex items-center gap-1.5 px-5 pt-3 pb-1.5">
          <Users size={12} className="text-neutral-400" />
          <span className="text-[10.5px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{t.sharedWithMe}</span>
        </div>
        <div className="flex-1 overflow-y-auto pb-1">
          {sharedPages.length === 0 ? (
            <div className="px-5 py-4 text-center">
              <p className="text-[12px] text-neutral-400">{t.noSharedPages}</p>
            </div>
          ) : (
            sharedPages.map(sp => (
              <div key={sp.id}
                className={`flex items-center gap-2 py-[6px] px-2.5 mx-2 rounded-lg cursor-pointer transition-colors text-[13px] ${
                  activePageId === sp.id ? 'bg-violet-50/80 dark:bg-violet-900/20 text-violet-500 dark:text-violet-300' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800'
                }`}
                onClick={() => onOpenSharedPage?.(sp.id)}
              >
                <span className="flex-shrink-0 text-base leading-none">{sp.icon || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-medium">{sharedTitles[sp.id] || t.untitled}</p>
                  {sp.shared_by_email && (
                    <p className="truncate text-[11px] text-neutral-400">{sp.shared_by_email}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-neutral-200/50 dark:border-neutral-800 space-y-0.5">
        <button onClick={onOpenTrash} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800 transition">
          <Trash2 size={17} /><span>{t.trash}</span>
        </button>
        <button onClick={onOpenTips} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800 transition">
          <HelpCircle size={17} /><span>{t.help}</span>
        </button>

        <div className="relative">
          <button onClick={openUserMenu} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800 transition">
            <div className="w-7 h-7 rounded-full bg-neutral-400 dark:bg-neutral-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {(displayName || email || '?').charAt(0).toUpperCase()}
            </div>
            <span className="truncate">{displayName || email}</span>
          </button>
          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute left-0 bottom-full mb-1 w-64 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden">
                <div className="px-4 pt-3 pb-2 border-b border-neutral-100 dark:border-neutral-700">
                  <p className="text-[11px] text-neutral-400 uppercase tracking-wider mb-0.5">{t.account}</p>
                  <p className="text-sm text-neutral-800 dark:text-neutral-200 truncate">{email}</p>
                </div>
                <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
                  <label className="text-[11px] text-neutral-400 uppercase tracking-wider block mb-1">{t.displayName}</label>
                  <div className="flex gap-1.5">
                    <input type="text" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-800 dark:text-neutral-200 outline-none focus:border-violet-400" placeholder={t.displayNamePlaceholder} />
                    <button onClick={handleSaveProfile} disabled={saving} className="px-2 py-1 rounded-md bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium transition disabled:opacity-50"><Save size={12} /></button>
                  </div>
                </div>
                <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                  <LogOut size={15} /> {t.signOut}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
