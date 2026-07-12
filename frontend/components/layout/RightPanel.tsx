'use client';

import { useState, useEffect } from 'react';
import { FileDown, FileText, X, AlignLeft, Download, Users, Eye } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { unwrapPageKey, decryptOrNull } from '@/lib/crypto';
import type { TocHeading, SharedPageItem } from '@/lib/types';

interface RightPanelProps {
  content: string;
  title: string;
  onClose: () => void;
  onExportMarkdown: () => void;
  onExportPDF: () => void;
  activePageId: string | null;
  tocHeadings?: TocHeading[];
  onOpenSharedPage?: (pageId: string) => void;
}

export default function RightPanel({
  content, title, onClose, onExportMarkdown, onExportPDF,
  activePageId, tocHeadings = [], onOpenSharedPage,
}: RightPanelProps) {
  const { t } = useLanguage();
  const { privateKey, workspaceId } = useAuth();

  const [sharedPages, setSharedPages] = useState<SharedPageItem[]>([]);
  const [sharedTitles, setSharedTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get<SharedPageItem[]>('/shared-pages').then(async (pages) => {
      setSharedPages(pages);
      if (!privateKey) return;
      const titles: Record<string, string> = {};
      await Promise.allSettled(pages.map(async (sp) => {
        if (!sp.page_key_grant) { titles[sp.id] = t.lockedPage; return; }
        try {
          const pageKey = await unwrapPageKey(sp.page_key_grant, privateKey);
          titles[sp.id] = sp.title ? ((await decryptOrNull(sp.title, pageKey)) ?? t.lockedPage) : '';
        } catch { titles[sp.id] = t.lockedPage; }
      }));
      setSharedTitles(titles);
    }).catch(() => {});
  }, [workspaceId, privateKey, t.lockedPage]);

  return (
    <aside className="w-[260px] h-full flex flex-col bg-[var(--bg-surface-2)] border-l border-[var(--border-subtle)] flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--border-subtle)] flex-shrink-0">
        <span className="text-[11px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider">
          {t.overview}
        </span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
          title={t.close}
        >
          <X size={14} />
        </button>
      </div>

      {/* Table of Contents */}
      {tocHeadings.length > 0 && (
        <div className="px-3 py-2.5 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-1.5 px-1 mb-2">
            <AlignLeft size={11} className="text-[var(--fg-tertiary)] flex-shrink-0" />
            <p className="text-[10px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider">
              {t.contents}
            </p>
          </div>
          <div className="space-y-0.5 max-h-52 overflow-y-auto">
            {tocHeadings.map((h) => (
              <button
                key={h.id}
                onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="w-full text-left py-1.5 rounded-md text-[12.5px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors truncate"
                style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px`, paddingRight: '8px' }}
                title={h.text}
              >
                <span className={h.level === 1 ? 'font-semibold' : 'font-normal'}>{h.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Shared With Me */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2.5">
        <div className="flex items-center gap-1.5 px-1 mb-2">
          <Users size={11} className="text-[var(--fg-tertiary)] flex-shrink-0" />
          <p className="text-[10px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider">
            {t.sharedWithMe}
          </p>
        </div>
        {sharedPages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-9 h-9 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center mb-2.5">
              <Users size={16} className="text-[var(--fg-quaternary)]" />
            </div>
            <p className="text-[11.5px] text-[var(--fg-tertiary)]">{t.noSharedPages}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sharedPages.map(sp => (
              <button
                key={sp.id}
                onClick={() => onOpenSharedPage?.(sp.id)}
                className={`w-full flex items-start gap-2.5 py-2 px-2.5 rounded-lg text-left transition-colors ${
                  activePageId === sp.id
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]'
                }`}
              >
                <span className="flex-shrink-0 text-[14px] leading-[1.4] mt-px">
                  {sp.icon || '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[12.5px] font-medium leading-snug">
                    {sharedTitles[sp.id] || t.untitled}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {sp.shared_by_email && (
                      <p className="truncate text-[10.5px] text-[var(--fg-tertiary)] flex-1 min-w-0">
                        {sp.shared_by_email}
                      </p>
                    )}
                    <span className={`flex-shrink-0 flex items-center gap-0.5 text-[9.5px] font-medium px-1.5 py-0.5 rounded-full ${
                      sp.permission === 'edit'
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'bg-[var(--bg-surface-3)] text-[var(--fg-tertiary)]'
                    }`}>
                      {sp.permission === 'edit' ? <FileText size={8} /> : <Eye size={8} />}
                      {sp.permission}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Export - bottom (only when a page is active) */}
      {activePageId && (
        <div className="px-3 py-2.5 border-t border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex items-center gap-1.5 px-1 mb-2">
            <Download size={11} className="text-[var(--fg-tertiary)]" />
            <p className="text-[10px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider">
              {t.export}
            </p>
          </div>
          <button
            onClick={onExportMarkdown}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors"
          >
            <FileText size={13} className="text-[var(--fg-tertiary)] flex-shrink-0" />
            <span>{t.markdownExport}</span>
          </button>
          <button
            onClick={onExportPDF}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors"
          >
            <FileDown size={13} className="text-[var(--fg-tertiary)] flex-shrink-0" />
            <span>{t.pdfExport}</span>
          </button>
        </div>
      )}
    </aside>
  );
}
