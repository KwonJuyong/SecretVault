'use client';

import {
  CheckCircle2, Loader2, AlertCircle, Cloud,
  PanelLeftClose, PanelLeft, PanelRightClose, PanelRight,
  Share2, Globe,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface TopbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  pageTitle?: string;
  rightPanelOpen?: boolean;
  onToggleRightPanel?: () => void;
  onShare?: () => void;
}

export default function Topbar({
  sidebarOpen, onToggleSidebar, saveStatus, pageTitle,
  rightPanelOpen, onToggleRightPanel, onShare,
}: TopbarProps) {
  const { lang, setLang, t } = useLanguage();
  const toggleLang = () => setLang(lang === 'en' ? 'ko' : 'en');

  return (
    <header className="h-12 flex items-center px-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex-shrink-0 gap-1">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
        title={sidebarOpen ? t.closeSidebar : t.openSidebar}
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
      </button>

      {pageTitle && (
        <>
          <div className="mx-2 w-px h-4 bg-[var(--border-default)]" />
          <span className="text-[13px] text-[var(--fg-secondary)] truncate font-medium">
            {pageTitle || t.untitled}
          </span>
        </>
      )}

      <div className="flex-1" />

      {/* Save status */}
      <div className="flex items-center gap-1.5 px-2.5 text-[12px] text-[var(--fg-tertiary)] h-7">
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
        className="flex items-center gap-1.5 px-2.5 h-8 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] text-[12.5px] font-semibold transition-colors"
        title={t.language}
      >
        <Globe size={15} />
        <span>{lang === 'en' ? 'EN' : 'KO'}</span>
      </button>

      {/* Share button */}
      {onShare && (
        <button
          onClick={onShare}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[12.5px] font-semibold transition-colors shadow-[var(--shadow-xs)] ml-1"
        >
          <Share2 size={14} />
          <span>{t.share}</span>
        </button>
      )}

      {/* Right panel toggle */}
      {onToggleRightPanel && (
        <button
          onClick={onToggleRightPanel}
          className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors ml-0.5"
          title={rightPanelOpen ? t.closePanel : t.openPanel}
        >
          {rightPanelOpen ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
        </button>
      )}
    </header>
  );
}
