'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Workspace } from '@/lib/types';
import { ChevronDown, Plus, Settings, Check } from 'lucide-react';

interface WorkspaceSwitcherProps {
  currentWorkspaceId: string;
  onSwitch: (workspace: Workspace) => void;
  onOpenSettings: (workspace: Workspace) => void;
  onCreateWorkspace: () => void;
}

export default function WorkspaceSwitcher({
  currentWorkspaceId, onSwitch, onOpenSettings, onCreateWorkspace,
}: WorkspaceSwitcherProps) {
  const { t } = useLanguage();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [open, setOpen] = useState(false);

  const fetchWorkspaces = async () => {
    try {
      const data = await api.get<Workspace[]>('/workspaces');
      setWorkspaces(data);
    } catch (e) {
      console.error('Failed to fetch workspaces:', e);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [currentWorkspaceId]);

  const current = workspaces.find(w => w.id === currentWorkspaceId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors group"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-[var(--border-subtle)] flex items-center justify-center text-[15px] flex-shrink-0">
          {current?.icon || '\u{1F4BC}'}
        </div>
        <span className="text-[13px] font-semibold text-[var(--fg-primary)] truncate flex-1 text-left">
          {current?.name || 'Workspace'}
        </span>
        <ChevronDown
          size={13}
          className={`text-[var(--fg-tertiary)] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 w-[272px] bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] shadow-[var(--shadow-lg)] z-50 overflow-hidden animate-scale-in origin-top-left">
            <div className="px-3 pt-3 pb-1.5">
              <p className="text-[10px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider">
                {t.workspaces}
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto px-1.5 pb-1.5">
              {workspaces.map(ws => (
                <div
                  key={ws.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors group ${
                    ws.id === currentWorkspaceId
                      ? 'bg-[var(--accent-soft)]'
                      : 'hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <button
                    className="flex items-center gap-2.5 flex-1 min-w-0"
                    onClick={() => { onSwitch(ws); setOpen(false); }}
                  >
                    <span className="text-[16px] w-7 h-7 rounded-md bg-[var(--bg-surface-2)] flex items-center justify-center flex-shrink-0">
                      {ws.icon || '\u{1F4BC}'}
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <p className={`text-[13px] font-medium truncate ${ws.id === currentWorkspaceId ? 'text-[var(--accent)]' : 'text-[var(--fg-primary)]'}`}>
                        {ws.name}
                      </p>
                      <p className="text-[10.5px] text-[var(--fg-tertiary)] capitalize">{ws.role}</p>
                    </div>
                    {ws.id === currentWorkspaceId && (
                      <Check size={13} className="text-[var(--accent)] flex-shrink-0" />
                    )}
                  </button>
                  {(ws.role === 'owner' || ws.role === 'admin') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenSettings(ws); setOpen(false); }}
                      className="p-1 rounded-md hover:bg-[var(--bg-hover-strong)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                      title={t.workspaceSettings}
                    >
                      <Settings size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="p-1.5 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => { onCreateWorkspace(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12.5px] font-medium text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors"
              >
                <Plus size={14} />
                <span>{t.createWorkspace}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
