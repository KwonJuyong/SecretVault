'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { versionToProseMirrorJSON, previewText } from '@/lib/history';
import { X, History, RotateCcw, Loader2, Lock } from 'lucide-react';

interface VersionSummary {
  id: number;
  created_at: string;
  created_by_email: string | null;
}

interface HistoryPanelProps {
  workspaceId: string;
  pageId: string;
  pageKey: CryptoKey | null;
  onRestore: (json: unknown) => void;
  onClose: () => void;
}

export default function HistoryPanel({
  workspaceId, pageId, pageKey, onRestore, onClose,
}: HistoryPanelProps) {
  const { t, lang } = useLanguage();
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ id: number; text: string; json: unknown } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<VersionSummary[]>(
          `/workspaces/${workspaceId}/pages/${pageId}/versions`,
        );
        if (!cancelled) setVersions(data);
      } catch (e) {
        console.error('Failed to load history:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId, pageId]);

  const openVersion = useCallback(async (id: number) => {
    if (!pageKey) return;
    setSelected(id);
    setPreview(null);
    try {
      const { encrypted_snapshot } = await api.get<{ encrypted_snapshot: string }>(
        `/workspaces/${workspaceId}/pages/${pageId}/versions/${id}`,
      );
      const json = await versionToProseMirrorJSON(encrypted_snapshot, pageKey);
      setPreview({ id, text: previewText(json, 400), json });
    } catch (e) {
      console.error('Failed to open version:', e);
    }
  }, [workspaceId, pageId, pageKey]);

  const restore = useCallback(() => {
    if (!preview) return;
    setBusy(true);
    onRestore(preview.json);
    onClose();
  }, [preview, onRestore, onClose]);

  const when = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[420px] max-w-full bg-[var(--bg-surface)] border-l border-[var(--border-default)] shadow-[var(--shadow-xl)] z-50 flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--border-subtle)] flex-shrink-0">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold">
            <History size={16} /> {t.pageHistory}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {!pageKey ? (
          <Empty icon={<Lock size={20} />} text={t.lockedPageNotice} />
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--fg-tertiary)]" />
          </div>
        ) : versions.length === 0 ? (
          <Empty icon={<History size={20} />} text={t.noHistoryYet} />
        ) : (
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {versions.map(v => (
              <div key={v.id}>
                <button
                  onClick={() => openVersion(v.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    selected === v.id
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <p className="text-[13px] font-medium text-[var(--fg-primary)]">{when(v.created_at)}</p>
                  {v.created_by_email && (
                    <p className="text-[11.5px] text-[var(--fg-tertiary)] truncate">{v.created_by_email}</p>
                  )}
                </button>

                {selected === v.id && (
                  <div className="mt-1.5 mb-1 px-3 py-2.5 rounded-lg bg-[var(--bg-surface-2)] border border-[var(--border-subtle)]">
                    {preview?.id === v.id ? (
                      <>
                        <p className="text-[12px] text-[var(--fg-secondary)] leading-relaxed whitespace-pre-wrap break-words mb-2.5">
                          {preview.text || t.emptyVersion}
                        </p>
                        <button
                          onClick={restore}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[12.5px] font-semibold transition-colors"
                        >
                          <RotateCcw size={12} /> {t.restoreThisVersion}
                        </button>
                        <p className="text-[11px] text-[var(--fg-tertiary)] mt-2 leading-relaxed">
                          {t.restoreNotice}
                        </p>
                      </>
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--fg-tertiary)]" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="text-[var(--fg-tertiary)] mb-3">{icon}</div>
      <p className="text-[12.5px] text-[var(--fg-tertiary)] leading-relaxed">{text}</p>
    </div>
  );
}
