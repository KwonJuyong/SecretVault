'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, FileText, X } from 'lucide-react';
import type { PageTreeItem } from '@/lib/types';

interface SearchModalProps {
  pages: PageTreeItem[];
  decryptedTitles: Record<string, string>;
  onSelect: (pageId: string) => void;
  onClose: () => void;
}

export default function SearchModal({ pages, decryptedTitles, onSelect, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const decryptedPages = pages.map(p => ({
    ...p,
    decryptedTitle: decryptedTitles[p.id] || 'Untitled',
  }));

  const filtered = query.trim()
    ? decryptedPages.filter(p =>
        p.decryptedTitle.toLowerCase().includes(query.toLowerCase())
      )
    : decryptedPages;

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSelectedIndex(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filtered[selectedIndex]) { onSelect(filtered[selectedIndex].id); onClose(); }
    else if (e.key === 'Escape') { onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <Search size={18} className="text-neutral-400 flex-shrink-0" />
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Search pages..." className="flex-1 bg-transparent text-neutral-800 dark:text-white text-sm outline-none placeholder-neutral-400" />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"><X size={16} /></button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-neutral-400 text-sm">{query ? 'No pages found.' : 'No pages yet.'}</div>
          ) : (
            filtered.map((page, i) => (
              <button key={page.id} onClick={() => { onSelect(page.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                  i === selectedIndex ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}>
                <span className="text-base flex-shrink-0">{page.icon || ''}</span>
                <FileText size={15} className="flex-shrink-0 opacity-40" />
                <span className="text-sm truncate">{page.decryptedTitle}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
