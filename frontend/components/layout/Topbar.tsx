'use client';

import { Menu, CheckCircle, Loader2, AlertCircle, PanelLeftClose, PanelLeft, PanelRightClose, PanelRight } from 'lucide-react';

interface TopbarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  pageTitle?: string;
  rightPanelOpen?: boolean;
  onToggleRightPanel?: () => void;
}

export default function Topbar({ sidebarOpen, onToggleSidebar, saveStatus, pageTitle, rightPanelOpen, onToggleRightPanel }: TopbarProps) {
  return (
    <div className="h-14 flex items-center px-5 border-b border-[rgba(55,53,47,0.05)] dark:border-[rgba(255,255,255,0.05)] bg-white dark:bg-[#202020] flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors duration-200 mr-3"
        title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? <PanelLeftClose size={21} /> : <PanelLeft size={21} />}
      </button>

      {pageTitle && (
        <span className="text-[15px] text-neutral-500 dark:text-neutral-500 truncate">
          {pageTitle}
        </span>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {/* Save status */}
        <div className="flex items-center gap-2 text-[14px] text-neutral-400 mr-2">
          {saveStatus === 'saving' && (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <CheckCircle size={16} className="text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Saved</span>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-red-500">Save failed</span>
            </>
          )}
        </div>

        {/* Right panel toggle */}
        {onToggleRightPanel && (
          <button
            onClick={onToggleRightPanel}
            className="p-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition-colors duration-200"
            title={rightPanelOpen ? 'Close panel' : 'Open panel'}
          >
            {rightPanelOpen ? <PanelRightClose size={21} /> : <PanelRight size={21} />}
          </button>
        )}
      </div>
    </div>
  );
}
