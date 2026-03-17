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
    <div className="h-12 flex items-center px-4 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm flex-shrink-0">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition mr-2"
        title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
      </button>

      {pageTitle && (
        <span className="text-sm text-neutral-400 dark:text-neutral-500 truncate">
          {pageTitle}
        </span>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Save status */}
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 mr-2">
          {saveStatus === 'saving' && (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <CheckCircle size={13} className="text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Saved</span>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <AlertCircle size={13} className="text-red-500" />
              <span className="text-red-500">Save failed</span>
            </>
          )}
        </div>

        {/* Right panel toggle */}
        {onToggleRightPanel && (
          <button
            onClick={onToggleRightPanel}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition"
            title={rightPanelOpen ? 'Close panel' : 'Open panel'}
          >
            {rightPanelOpen ? <PanelRightClose size={18} /> : <PanelRight size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}
