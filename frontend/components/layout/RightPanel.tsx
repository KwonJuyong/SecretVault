'use client';

import { useState } from 'react';
import { FileDown, FileText, ChevronRight, X, AlignLeft } from 'lucide-react';
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
    const title = decryptedTitles[page.id] || t.untitled;

    return (
      <div key={page.id}>
        <button
          onClick={() => onSelectPage(page.id)}
          className={`w-full flex items-center gap-1.5 py-[5px] px-2 rounded-md text-left transition-colors text-[12.5px] ${
            isActive
              ? 'bg-violet-50/70 dark:bg-violet-900/15 text-violet-500 dark:text-violet-300'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800'
          }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          {hasChildren ? (
            <span
              onClick={e => { e.stopPropagation(); toggleCollapse(page.id); }}
              className="flex-shrink-0 p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
            >
              <ChevronRight size={11} className={`transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} />
            </span>
          ) : (
            <span className="w-[15px] flex-shrink-0" />
          )}
          {page.icon && <span className="text-xs leading-none flex-shrink-0">{page.icon}</span>}
          <span className="truncate">{title}</span>
        </button>
        {hasChildren && !isCollapsed && children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="w-[240px] h-full flex flex-col bg-[#f8f8f7] dark:bg-[#1a1a1a] border-l border-neutral-200/70 dark:border-neutral-800 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200/70 dark:border-neutral-800">
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{t.overview}</span>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 transition">
          <X size={14} />
        </button>
      </div>

      {/* Table of Contents */}
      {tocHeadings.length > 0 && (
        <div className="p-2 border-b border-neutral-200/50 dark:border-neutral-800">
          <div className="flex items-center gap-1.5 px-2 mb-1.5">
            <AlignLeft size={10} className="text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
            <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{t.contents}</p>
          </div>
          <div className="space-y-0.5">
            {tocHeadings.map((h) => (
              <button
                key={h.id}
                onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="w-full text-left py-[4px] px-2 rounded-md text-[12px] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors truncate"
                style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
                title={h.text}
              >
                <span className={h.level === 1 ? 'font-medium' : 'font-normal'}>{h.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Page tree */}
      <div className="flex-1 overflow-y-auto p-2">
        <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-2 mb-1.5">{t.pages}</p>
        {rootPages.length === 0 ? (
          <p className="text-[11px] text-neutral-400 px-2 py-3 text-center">{t.noPages}</p>
        ) : (
          rootPages.map(page => renderNode(page))
        )}
      </div>

      {/* Export - bottom */}
      <div className="p-3 space-y-1.5 border-t border-neutral-200/50 dark:border-neutral-800">
        <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1 mb-1">{t.export}</p>
        <button
          onClick={onExportMarkdown}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
        >
          <FileText size={14} className="text-neutral-400" />
          <span>{t.markdownExport}</span>
        </button>
        <button
          onClick={onExportPDF}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
        >
          <FileDown size={14} className="text-neutral-400" />
          <span>{t.pdfExport}</span>
        </button>
      </div>
    </div>
  );
}
