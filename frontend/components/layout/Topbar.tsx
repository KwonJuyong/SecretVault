'use client';

import { Menu, CheckCircle, Loader2, AlertCircle, PanelLeftClose, PanelLeft, PanelRightClose, PanelRight, Share2, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/contexts/LanguageContext';

interface TopbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  pageTitle?: string;
  rightPanelOpen?: boolean;
  onToggleRightPanel?: () => void;
  onShare?: () => void;
}

export default function Topbar({ sidebarOpen, onToggleSidebar, saveStatus, pageTitle, rightPanelOpen, onToggleRightPanel, onShare }: TopbarProps) {
  const { lang, setLang, t } = useLanguage();

  const toggleLang = () => {
    setLang(lang === 'en' ? 'ko' : 'en');
  };

  return (
    <div className="h-12 flex items-center px-6 border-b border-[rgba(55,53,47,0.06)] dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[#202020] flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors duration-200 mr-3"
        title={sidebarOpen ? t.closeSidebar : t.openSidebar}
      >
        {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
      </button>

      {pageTitle && (
        <span className="text-[15px] text-neutral-500 dark:text-neutral-500 truncate">
          {pageTitle}
        </span>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {/* Save status */}
        <div className="flex items-center gap-2 text-sm text-neutral-400 mr-2">
          {saveStatus === 'saving' && (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>{t.saving}</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <CheckCircle size={15} className="text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">{t.saved}</span>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <AlertCircle size={15} className="text-red-500" />
              <span className="text-red-500">{t.saveFailed}</span>
            </>
          )}
        </div>

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 text-[13px] font-medium transition-colors duration-200"
          title={t.language}
        >
          <Globe size={15} />
          <span>{lang === 'en' ? 'EN' : 'KO'}</span>
        </button>

        {/* Share button */}
        {onShare && (
          <button
            onClick={onShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[13px] font-medium transition-colors duration-200"
          >
            <Share2 size={14} />
            {t.share}
          </button>
        )}

        {/* Right panel toggle */}
        {onToggleRightPanel && (
          <button
            onClick={onToggleRightPanel}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors duration-200"
            title={rightPanelOpen ? t.closePanel : t.openPanel}
          >
            {rightPanelOpen ? <PanelRightClose size={20} /> : <PanelRight size={20} />}
          </button>
        )}
      </div>
    </div>
  );
}
