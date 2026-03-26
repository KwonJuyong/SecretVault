'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
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
        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
      >
        <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-sm flex-shrink-0">
          {current?.icon || '\u{1F4BC}'}
        </div>
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate flex-1 text-left">
          {current?.name || 'Workspace'}
        </span>
        <ChevronDown size={14} className={`text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-72 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-700">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Workspaces</p>
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5">
              {workspaces.map(ws => (
                <div
                  key={ws.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition group ${
                    ws.id === currentWorkspaceId
                      ? 'bg-violet-50 dark:bg-violet-900/20'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50'
                  }`}
                >
                  <button
                    className="flex items-center gap-2 flex-1 min-w-0"
                    onClick={() => { onSwitch(ws); setOpen(false); }}
                  >
                    <span className="text-lg flex-shrink-0">{ws.icon || '\u{1F4BC}'}</span>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{ws.name}</p>
                      <p className="text-[11px] text-neutral-400 capitalize">{ws.role}</p>
                    </div>
                    {ws.id === currentWorkspaceId && <Check size={14} className="text-violet-500 flex-shrink-0" />}
                  </button>
                  {(ws.role === 'owner' || ws.role === 'admin') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenSettings(ws); setOpen(false); }}
                      className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-600 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                      title="Workspace settings"
                    >
                      <Settings size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="p-1.5 border-t border-neutral-100 dark:border-neutral-700">
              <button
                onClick={() => { onCreateWorkspace(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition"
              >
                <Plus size={16} />
                <span>Create Workspace</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
