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
      setPages(data.map(p => ({
        ...p,
        decryptedTitle: p.icon ? `${p.icon} Page` : 'Deleted page',
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTrash(); }, []);

  const handleRestore = async (pageId: string) => {
    try { await api.post(`/workspaces/${workspaceId}/pages/${pageId}/restore`); fetchTrash(); onRestore(); }
    catch (e) { console.error(e); }
  };

  const handlePermanentDelete = async (pageId: string) => {
    if (!confirm(t.permanentDeleteConfirm)) return;
    try { await api.delete(`/workspaces/${workspaceId}/pages/${pageId}?permanent=true`); fetchTrash(); }
    catch (e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Trash2 size={18} className="text-neutral-500" />
            <h2 className="text-base font-semibold text-neutral-800 dark:text-white">{t.trash}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"><X size={18} /></button>
        </div>
        <div className="max-h-96 overflow-y-auto p-3">
          {loading ? (
            <div className="py-8 text-center text-neutral-400 text-sm">{t.loading}</div>
          ) : pages.length === 0 ? (
            <div className="py-8 text-center text-neutral-400 text-sm">{t.trashEmpty}</div>
          ) : (
            pages.map(page => (
              <div key={page.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 group">
                <FileText size={15} className="text-neutral-400 flex-shrink-0" />
                <span className="text-sm text-neutral-600 dark:text-neutral-400 truncate flex-1">{page.decryptedTitle}</span>
                <button onClick={() => handleRestore(page.id)} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-neutral-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition" title={t.restore}>
                  <RotateCcw size={14} />
                </button>
                <button onClick={() => handlePermanentDelete(page.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition" title={t.deletePermanently}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
