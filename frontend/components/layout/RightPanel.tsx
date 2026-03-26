'use client';

import { useMemo } from 'react';
import { FileDown, FileText, X } from 'lucide-react';

interface RightPanelProps {
  content: string;
  title: string;
  onClose: () => void;
  onExportMarkdown: () => void;
  onExportPDF: () => void;
}

function countWords(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

function countChars(html: string): number {
  if (!html) return 0;
  return html.replace(/<[^>]*>/g, '').length;
}

export default function RightPanel({ content, title, onClose, onExportMarkdown, onExportPDF }: RightPanelProps) {
  const wordCount = useMemo(() => countWords(content), [content]);
  const charCount = useMemo(() => countChars(content), [content]);

  return (
    <div className="w-[240px] h-full flex flex-col bg-[#f8f8f7] dark:bg-[#1a1a1a] border-l border-neutral-200/70 dark:border-neutral-800 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200/70 dark:border-neutral-800">
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Export</span>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 transition">
          <X size={14} />
        </button>
      </div>

      {/* Export buttons */}
      <div className="p-3 space-y-1.5">
        <button
          onClick={onExportMarkdown}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition border border-neutral-200/60 dark:border-neutral-700/50"
        >
          <FileText size={16} className="text-neutral-500" />
          <span>Markdown (.md)</span>
        </button>
        <button
          onClick={onExportPDF}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition border border-neutral-200/60 dark:border-neutral-700/50"
        >
          <FileDown size={16} className="text-neutral-500" />
          <span>PDF</span>
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-t border-neutral-200/50 dark:border-neutral-800 mt-auto">
        <p className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Stats</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Words</span>
            <span className="font-medium text-neutral-700 dark:text-neutral-300">{wordCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Characters</span>
            <span className="font-medium text-neutral-700 dark:text-neutral-300">{charCount.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
