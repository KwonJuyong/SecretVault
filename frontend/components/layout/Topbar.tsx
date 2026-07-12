'use client';

import {
  CheckCircle2, Loader2, AlertCircle, Cloud,
  PanelLeftClose, PanelLeft, PanelRightClose, PanelRight,
  Share2, Globe, ChevronRight, History,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PageTreeItem } from '@/lib/types';

interface TopbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  pageTitle?: string;
  rightPanelOpen?: boolean;
  onToggleRightPanel?: () => void;
  onShare?: () => void;
  onOpenHistory?: () => void;
  /** Root → … → current page. The last entry is the page you are on. */
  breadcrumbs?: PageTreeItem[];
  decryptedTitles?: Record<string, string>;
  onSelectPage?: (pageId: string) => void;
}

export default function Topbar({
  sidebarOpen, onToggleSidebar, saveStatus, pageTitle,
  rightPanelOpen, onToggleRightPanel, onShare, onOpenHistory,
  breadcrumbs = [], decryptedTitles = {}, onSelectPage,
}: TopbarProps) {
  const { lang, setLang, t } = useLanguage();
  const toggleLang = () => setLang(lang === 'en' ? 'ko' : 'en');

  // Long chains get elided in the middle: the root and the last two are what orient you.
  const trail = breadcrumbs.length > 4
    ? [breadcrumbs[0], null, ...breadcrumbs.slice(-2)]
    : breadcrumbs;

  return (
    <header className="h-14 flex items-center px-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex-shrink-0 gap-1">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
        title={sidebarOpen ? t.closeSidebar : t.openSidebar}
      >
        {sidebarOpen ? <PanelLeftClose size={19} /> : <PanelLeft size={19} />}
      </button>

      {trail.length > 0 ? (
        <>
          <div className="mx-2 w-px h-4 bg-[var(--border-default)]" />
          <nav className="flex items-center gap-0.5 min-w-0 text-[13px]" aria-label="Breadcrumb">
            {trail.map((crumb, i) => {
              const isLast = i === trail.length - 1;
              return (
                <span key={crumb?.id ?? `gap-${i}`} className="flex items-center gap-0.5 min-w-0">
                  {i > 0 && (
                    <ChevronRight size={13} className="flex-shrink-0 text-[var(--fg-quaternary)]" />
                  )}
                  {crumb === null ? (
                    <span className="px-1 text-[var(--fg-quaternary)]">…</span>
                  ) : (
                    <button
                      onClick={() => !isLast && onSelectPage?.(crumb.id)}
                      disabled={isLast}
                      className={`px-1.5 py-1 rounded-md truncate max-w-[180px] transition-colors ${
                        isLast
                          ? 'text-[var(--fg-primary)] font-medium cursor-default'
                          : 'text-[var(--fg-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]'
                      }`}
                    >
                      {crumb.icon && <span className="mr-1">{crumb.icon}</span>}
                      {decryptedTitles[crumb.id] || t.untitled}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
        </>
      ) : pageTitle ? (
        <>
          <div className="mx-2 w-px h-4 bg-[var(--border-default)]" />
          <span className="text-[13px] text-[var(--fg-secondary)] truncate font-medium">
            {pageTitle || t.untitled}
          </span>
        </>
      ) : null}

      <div className="flex-1" />

      {/* Save status */}
      <div className="flex items-center gap-1.5 px-2.5 text-[12.5px] text-[var(--fg-tertiary)] h-8">
        {saveStatus === 'idle' && (
          <>
            <Cloud size={14} className="opacity-50" />
            <span className="hidden sm:inline">{t.saved}</span>
          </>
        )}
        {saveStatus === 'saving' && (
          <>
            <Loader2 size={14} className="animate-spin text-[var(--accent)]" />
            <span className="hidden sm:inline">{t.saving}</span>
          </>
        )}
        {saveStatus === 'saved' && (
          <>
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="hidden sm:inline text-emerald-600 dark:text-emerald-400 font-medium">{t.saved}</span>
          </>
        )}
        {saveStatus === 'error' && (
          <>
            <AlertCircle size={14} className="text-red-500" />
            <span className="hidden sm:inline text-red-500 font-medium">{t.saveFailed}</span>
          </>
        )}
      </div>

      {/* Language toggle */}
      <button
        onClick={toggleLang}
        className="flex items-center gap-2 px-5 h-9 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] text-[13px] font-semibold transition-colors"
        title={t.language}
      >
        <Globe size={16} />
        <span>{lang === 'en' ? 'EN' : 'KO'}</span>
      </button>

      {/* History */}
      {onOpenHistory && (
        <button
          onClick={onOpenHistory}
          className="p-2 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
          title={t.pageHistory}
        >
          <History size={17} />
        </button>
      )}

      {/* Share button */}
      {onShare && (
        <button
          onClick={onShare}
          className="flex items-center gap-2 px-5 h-9 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-semibold transition-colors shadow-[var(--shadow-xs)] ml-1"
        >
          <Share2 size={15} />
          <span>{t.share}</span>
        </button>
      )}

      {/* Right panel toggle */}
      {onToggleRightPanel && (
        <button
          onClick={onToggleRightPanel}
          className="p-2 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors ml-0.5"
          title={rightPanelOpen ? t.closePanel : t.openPanel}
        >
          {rightPanelOpen ? <PanelRightClose size={19} /> : <PanelRight size={19} />}
        </button>
      )}
    </header>
  );
}
