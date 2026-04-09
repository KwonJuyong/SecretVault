'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Workspace } from '@/lib/types';
import { X } from 'lucide-react';

interface CreateWorkspaceModalProps {
  onClose: () => void;
  onCreated: (workspace: Workspace) => void;
}

export default function CreateWorkspaceModal({ onClose, onCreated }: CreateWorkspaceModalProps) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('\u{1F4BC}');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const icons = ['\u{1F4BC}', '\u{1F680}', '\u{1F4DA}', '\u{1F52C}', '\u{1F3AF}', '\u{1F4BB}', '\u{1F9EA}', '\u2B50', '\u{1F525}', '\u{1F30D}', '\u{1F3E2}', '\u{1F465}'];

  const handleCreate = async () => {
    if (!name.trim()) {
      setError(t.workspaceNameRequired);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.post<Workspace>('/workspaces', {
        name: name.trim(),
        description: description.trim() || null,
        icon,
      });
      onCreated(data);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.failedToCreateWorkspace);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <h2 className="text-base font-semibold text-neutral-800 dark:text-white">{t.createWorkspace}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Icon picker */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{t.icon}</label>
            <div className="flex gap-1.5 flex-wrap">
              {icons.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`text-xl p-2 rounded-lg transition ${
                    icon === emoji
                      ? 'bg-violet-50 dark:bg-violet-900/30 ring-2 ring-violet-400'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t.name}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.workspaceNamePlaceholder}
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-800 dark:text-white outline-none focus:ring-2 focus:ring-violet-400/30"
              onKeyDown={e => !e.isComposing && e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t.descriptionOptional}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t.workspaceDescPlaceholder}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-800 dark:text-white outline-none focus:ring-2 focus:ring-violet-400/30 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white font-medium text-sm transition"
          >
            {loading ? t.creating : t.createWorkspace}
          </button>
        </div>
      </div>
    </div>
  );
}
