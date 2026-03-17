'use client';

import { useMemo } from 'react';
import { FileDown, FileText, Hash, X } from 'lucide-react';

interface HeadingItem {
  level: number;
  text: string;
  id: string;
}

interface RightPanelProps {
  content: string;
  title: string;
  onClose: () => void;
  onExportMarkdown: () => void;
  onExportPDF: () => void;
}

function extractHeadings(html: string): HeadingItem[] {
  if (!html) return [];
  const headings: HeadingItem[] = [];
  const regex = /<h([1-3])[^>]*>(.*?)<\/h[1-3]>/gi;
  let match;
  let idx = 0;
  while ((match = regex.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    if (text) {
      headings.push({
        level: parseInt(match[1]),
        text,
        id: `heading-${idx++}`,
      });
    }
  }
  return headings;
}

function countWords(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

export default function RightPanel({ content, title, onClose, onExportMarkdown, onExportPDF }: RightPanelProps) {
  const headings = useMemo(() => extractHeadings(content), [content]);
  const wordCount = useMemo(() => countWords(content), [content]);

  const scrollToHeading = (index: number) => {
    const editor = document.querySelector('.tiptap-content');
    if (!editor) return;
    const headingEls = editor.querySelectorAll('h1, h2, h3');
    const target = headingEls[index];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="w-[260px] h-full flex flex-col bg-[#f8f8f7] dark:bg-[#1a1a1a] border-l border-neutral-200/70 dark:border-neutral-800 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200/70 dark:border-neutral-800">
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Page Info</span>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 transition"
        >
          <X size={14} />
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>Words</span>
          <span className="font-medium text-neutral-700 dark:text-neutral-300">{wordCount}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
          <span>Headings</span>
          <span className="font-medium text-neutral-700 dark:text-neutral-300">{headings.length}</span>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-3 pb-1">
          <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Outline</span>
        </div>
        {headings.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <Hash size={20} className="mx-auto mb-2 text-neutral-300 dark:text-neutral-600" />
            <p className="text-xs text-neutral-400 dark:text-neutral-500">Add headings to see<br />the document outline</p>
          </div>
        ) : (
          <div className="px-2 py-1 space-y-0.5">
            {headings.map((h, i) => (
              <button
                key={h.id}
                onClick={() => scrollToHeading(i)}
                className="w-full text-left px-2 py-1.5 rounded-md text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition truncate"
                style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
              >
                <span className={`${h.level === 1 ? 'font-semibold' : h.level === 2 ? 'font-medium' : ''}`}>
                  {h.text}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="p-3 border-t border-neutral-200/70 dark:border-neutral-800 space-y-1">
        <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1 block mb-2">Export</span>
        <button
          onClick={onExportMarkdown}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
        >
          <FileText size={15} />
          <span>Markdown (.md)</span>
        </button>
        <button
          onClick={onExportPDF}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
        >
          <FileDown size={15} />
          <span>PDF</span>
        </button>
      </div>
    </div>
  );
}
