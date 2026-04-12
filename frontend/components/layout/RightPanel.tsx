'use client';

import { useState, useEffect } from 'react';
import { FileDown, FileText, X, AlignLeft, Download, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { unwrapPageKey, decrypt } from '@/lib/crypto';
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
        if (!sp.page_key_grant) return;
        try {
          const pageKey = await unwrapPageKey(sp.page_key_grant, privateKey);
          titles[sp.id] = sp.title ? await decrypt(sp.title, pageKey) : '';
        } catch { /* leave as empty */ }
      }));
      setSharedTitles(titles);
    }).catch(() => {});
  }, [workspaceId, privateKey]);

  return (
    <aside className="w-[252px] h-full flex flex-col bg-[var(--bg-surface-2)] border-l border-[var(--border-subtle)] flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--border-subtle)]">
        <span className="text-[11px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider">
          {t.overview}
        </span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Table of Contents */}
      {tocHeadings.length > 0 && (
        <div className="p-2 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5 px-2 mb-1.5">
            <AlignLeft size={10} className="text-[var(--fg-tertiary)] flex-shrink-0" />
            <p className="text-[10px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider">
              {t.contents}
            </p>
          </div>
          <div className="space-y-0.5">
            {tocHeadings.map((h) => (
              <button
                key={h.id}
                onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="w-full text-left py-1.5 px-2 rounded-md text-[12.5px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors truncate"
                style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
                title={h.text}
              >
                <span className={h.level === 1 ? 'font-semibold' : 'font-normal'}>{h.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Shared With Me */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        <div className="flex items-center gap-1.5 px-2 mb-1.5">
          <Users size={10} className="text-[var(--fg-tertiary)] flex-shrink-0" />
          <p className="text-[10px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider">
            {t.sharedWithMe}
          </p>
        </div>
        {sharedPages.length === 0 ? (
          <p className="text-[11px] text-[var(--fg-tertiary)] px-2 py-3 text-center">{t.noSharedPages}</p>
        ) : (
          <div className="space-y-0.5">
            {sharedPages.map(sp => (
              <button
                key={sp.id}
                onClick={() => onOpenSharedPage?.(sp.id)}
                className={`w-full flex items-start gap-2 py-2 px-2.5 rounded-md text-left transition-colors ${
                  activePageId === sp.id
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]'
                }`}
              >
                <span className="flex-shrink-0 text-[13px] leading-[1.3] w-[15px] text-center mt-[1px]">
                  {sp.icon || '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[12px] font-medium leading-tight">{sharedTitles[sp.id] || t.untitled}</p>
                  {sp.shared_by_email && (
                    <p className="truncate text-[10px] text-[var(--fg-tertiary)] mt-0.5">{sp.shared_by_email}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Export - bottom (only when a page is active) */}
      {activePageId && <div className="p-2 border-t border-[var(--border-subtle)]">
        <p className="text-[10px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider px-2 mb-1 flex items-center gap-1">
          <Download size={10} /> {t.export}
        </p>
        <button
          onClick={onExportMarkdown}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12.5px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors"
        >
          <FileText size={13} className="text-[var(--fg-tertiary)]" />
          <span>{t.markdownExport}</span>
        </button>
        <button
          onClick={onExportPDF}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12.5px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors"
        >
          <FileDown size={13} className="text-[var(--fg-tertiary)]" />
          <span>{t.pdfExport}</span>
        </button>
      </div>}
    </aside>
  );
}
