'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { generateWorkspaceKey, wrapWorkspaceKeyForUser } from '@/lib/crypto';
import type { Workspace } from '@/lib/types';
import { X, FolderPlus } from 'lucide-react';

interface CreateWorkspaceModalProps {
  onClose: () => void;
  onCreated: (workspace: Workspace) => void;
}

export default function CreateWorkspaceModal({ onClose, onCreated }: CreateWorkspaceModalProps) {
  const { t } = useLanguage();
  const { publicKey } = useAuth();
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
    if (!publicKey) {
      setError(t.failedToCreateWorkspace);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Mint the workspace's key here and hand the server only our wrapped copy of it.
      // Everything created in this workspace will be encrypted under it.
      const workspaceKey = await generateWorkspaceKey();
      const wrappedForMe = await wrapWorkspaceKeyForUser(workspaceKey, publicKey);

      const data = await api.post<Workspace>('/workspaces', {
        name: name.trim(),
        description: description.trim() || null,
        icon,
        encrypted_workspace_key: wrappedForMe,
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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] animate-fade-in"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md mx-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] shadow-[var(--shadow-xl)] overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
              <FolderPlus size={15} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-[14.5px] font-semibold text-[var(--fg-primary)]">{t.createWorkspace}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-6 space-y-5">
          {/* Icon picker */}
          <div>
            <label className="block text-[12.5px] font-medium text-[var(--fg-secondary)] mb-2.5">{t.icon}</label>
            <div className="flex gap-1.5 flex-wrap">
              {icons.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`text-[18px] w-9 h-9 rounded-lg transition flex items-center justify-center ${
                    icon === emoji
                      ? 'bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]'
                      : 'hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[12.5px] font-medium text-[var(--fg-secondary)] mb-2">{t.name}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t.workspaceNamePlaceholder}
              className="w-full px-4 h-11 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13.5px] text-[var(--fg-primary)] outline-none transition-shadow focus:border-[var(--accent)] focus:shadow-[var(--shadow-focus)] placeholder-[var(--fg-quaternary)]"
              onKeyDown={e => !e.nativeEvent.isComposing && e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12.5px] font-medium text-[var(--fg-secondary)] mb-2">{t.descriptionOptional}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t.workspaceDescPlaceholder}
              rows={2}
              className="w-full px-4 py-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13.5px] text-[var(--fg-primary)] outline-none transition-shadow focus:border-[var(--accent)] focus:shadow-[var(--shadow-focus)] placeholder-[var(--fg-quaternary)] resize-none"
            />
          </div>

          {error && <p className="text-[12.5px] text-red-500">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full h-11 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-semibold text-[13.5px] transition-colors shadow-[var(--shadow-sm)]"
          >
            {loading ? t.creating : t.createWorkspace}
          </button>
        </div>
      </div>
    </div>
  );
}
