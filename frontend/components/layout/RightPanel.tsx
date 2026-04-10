'use client';

import { useState } from 'react';
import { FileDown, FileText, ChevronRight, X, AlignLeft, Download } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PageTreeItem, TocHeading } from '@/lib/types';

interface RightPanelProps {
  content: string;
  title: string;
  onClose: () => void;
  onExportMarkdown: () => void;
  onExportPDF: () => void;
  pages: PageTreeItem[];
  decryptedTitles: Record<string, string>;
  activePageId: string | null;
  onSelectPage: (pageId: string) => void;
  tocHeadings?: TocHeading[];
}

export default function RightPanel({
  content, title, onClose, onExportMarkdown, onExportPDF,
  pages, decryptedTitles, activePageId, onSelectPage, tocHeadings = [],
}: RightPanelProps) {
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const rootPages = pages.filter(p => !p.parent_id);
  const childrenOf = (parentId: string) => pages.filter(p => p.parent_id === parentId);

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderNode = (page: PageTreeItem, depth: number = 0) => {
    const children = childrenOf(page.id);
    const hasChildren = children.length > 0 || page.has_children;
    const isActive = page.id === activePageId;
    const isCollapsed = collapsed.has(page.id);
    const pageTitle = decryptedTitles[page.id] || t.untitled;

    return (
      <div key={page.id}>
        <button
          onClick={() => onSelectPage(page.id)}
          className={`w-full flex items-center gap-1.5 py-[5px] px-2 rounded-md text-left transition-colors text-[12.5px] ${
            isActive
              ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
              : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]'
          }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          {hasChildren ? (
            <span
              onClick={e => { e.stopPropagation(); toggleCollapse(page.id); }}
              className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--bg-hover-strong)]"
            >
              <ChevronRight size={11} className={`transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} />
            </span>
          ) : (
            <span className="w-[15px] flex-shrink-0" />
          )}
          {page.icon && <span className="text-[12px] leading-none flex-shrink-0">{page.icon}</span>}
          <span className="truncate">{pageTitle}</span>
        </button>
        {hasChildren && !isCollapsed && children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <aside className="w-[252px] h-full flex flex-col bg-[var(--bg-surface-2)] border-l border-[var(--border-subtle)] flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--border-subtle)]">
        <span className="text-[11px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider">
          {t.overview}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
        >
          <X size={13} />
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
                className="w-full text-left py-[4px] px-2 rounded-md text-[12px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors truncate"
                style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
                title={h.text}
              >
                <span className={h.level === 1 ? 'font-semibold' : 'font-normal'}>{h.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Page tree */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        <p className="text-[10px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider px-2 mb-1.5">
          {t.pages}
        </p>
        {rootPages.length === 0 ? (
          <p className="text-[11px] text-[var(--fg-tertiary)] px-2 py-3 text-center">{t.noPages}</p>
        ) : (
          rootPages.map(page => renderNode(page))
        )}
      </div>

      {/* Export - bottom */}
      <div className="p-2 border-t border-[var(--border-subtle)]">
        <p className="text-[10px] font-semibold text-[var(--fg-tertiary)] uppercase tracking-wider px-2 mb-1 flex items-center gap-1">
          <Download size={10} /> {t.export}
        </p>
        <button
          onClick={onExportMarkdown}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12.5px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors"
        >
          <FileText size={13} className="text-[var(--fg-tertiary)]" />
          <span>{t.markdownExport}</span>
        </button>
        <button
          onClick={onExportPDF}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12.5px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] transition-colors"
        >
          <FileDown size={13} className="text-[var(--fg-tertiary)]" />
          <span>{t.pdfExport}</span>
        </button>
      </div>
    </aside>
  );
}
