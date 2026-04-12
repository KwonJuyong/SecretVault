'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, RotateCcw, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PageTreeItem } from '@/lib/types';

interface TrashPanelProps {
  workspaceId: string;
  onClose: () => void;
  onRestore: () => void;
}

export default function TrashPanel({ workspaceId, onClose, onRestore }: TrashPanelProps) {
  const { t } = useLanguage();
  const [pages, setPages] = useState<(PageTreeItem & { decryptedTitle: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrash = async () => {
    try {
      const data = await api.get<PageTreeItem[]>(`/workspaces/${workspaceId}/trash`);
      setPages(data.map(p => ({ ...p, decryptedTitle: '' })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTrash(); }, []);

  const handleRestore = async (pageId: string) => {
    try {
      await api.post(`/workspaces/${workspaceId}/pages/${pageId}/restore`);
      fetchTrash();
      onRestore();
    } catch (e) { console.error(e); }
  };

  const handlePermanentDelete = async (pageId: string) => {
    if (!confirm(t.permanentDeleteConfirm)) return;
    try {
      await api.delete(`/workspaces/${workspaceId}/pages/${pageId}?permanent=true`);
      fetchTrash();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] animate-fade-in" onClick={onClose}>
      <div className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md mx-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] shadow-[var(--shadow-xl)] overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--bg-surface-2)] flex items-center justify-center">
              <Trash2 size={15} className="text-[var(--fg-secondary)]" />
            </div>
            <h2 className="text-[14.5px] font-semibold text-[var(--fg-primary)]">{t.trash}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loading ? (
            <div className="py-12 text-center text-[var(--fg-tertiary)] text-[13px]">{t.loading}</div>
          ) : pages.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--bg-surface-2)] flex items-center justify-center">
                <Trash2 size={18} className="text-[var(--fg-tertiary)]" />
              </div>
              <p className="text-[13px] text-[var(--fg-tertiary)]">{t.trashEmpty}</p>
            </div>
          ) : (
            pages.map(page => (
              <div
                key={page.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[var(--bg-hover)] group transition-colors"
              >
                <span className="flex-shrink-0 text-[15px] leading-none w-[18px] text-center">
                  {page.icon || <FileText size={14} className="inline text-[var(--fg-tertiary)]" />}
                </span>
                <span className="text-[13px] text-[var(--fg-secondary)] truncate flex-1">
                  {t.untitled}
                </span>
                <button
                  onClick={() => handleRestore(page.id)}
                  className="p-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-500/15 text-[var(--fg-tertiary)] hover:text-emerald-600 dark:hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition"
                  title={t.restore}
                >
                  <RotateCcw size={13} />
                </button>
                <button
                  onClick={() => handlePermanentDelete(page.id)}
                  className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/15 text-[var(--fg-tertiary)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                  title={t.deletePermanently}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
