'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, FileText, X, CornerDownLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PageTreeItem } from '@/lib/types';

interface SearchModalProps {
  pages: PageTreeItem[];
  decryptedTitles: Record<string, string>;
  onSelect: (pageId: string) => void;
  onClose: () => void;
}

export default function SearchModal({ pages, decryptedTitles, onSelect, onClose }: SearchModalProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const decryptedPages = pages.map(p => ({
    ...p,
    decryptedTitle: decryptedTitles[p.id] || t.untitled,
  }));

  const filtered = query.trim()
    ? decryptedPages.filter(p => p.decryptedTitle.toLowerCase().includes(query.toLowerCase()))
    : decryptedPages;

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSelectedIndex(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filtered[selectedIndex]) { onSelect(filtered[selectedIndex].id); onClose(); }
    else if (e.key === 'Escape') { onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] animate-fade-in" onClick={onClose}>
      <div className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl mx-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] shadow-[var(--shadow-xl)] overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 h-14 border-b border-[var(--border-subtle)]">
          <Search size={17} className="text-[var(--fg-tertiary)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.searchPages}
            className="flex-1 bg-transparent text-[var(--fg-primary)] text-[14.5px] outline-none placeholder-[var(--fg-tertiary)]"
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--bg-surface-2)] flex items-center justify-center">
                <Search size={18} className="text-[var(--fg-tertiary)]" />
              </div>
              <p className="text-[13px] text-[var(--fg-tertiary)]">
                {query ? t.noPagesFound : t.noPagesYetSearch}
              </p>
            </div>
          ) : (
            filtered.map((page, i) => (
              <button
                key={page.id}
                onClick={() => { onSelect(page.id); onClose(); }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  i === selectedIndex
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span className="text-[17px] flex-shrink-0 leading-none w-[18px] text-center">
                  {page.icon || <FileText size={15} className="inline opacity-50" />}
                </span>
                <span className="text-[13.5px] font-medium truncate flex-1">{page.decryptedTitle}</span>
                {i === selectedIndex && (
                  <CornerDownLeft size={13} className="opacity-60 flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-5 h-10 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[11px] text-[var(--fg-tertiary)]">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="sc-kbd !px-1.5">↑</kbd>
            <kbd className="sc-kbd !px-1.5">↓</kbd>
            Navigate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="sc-kbd !px-1.5">↵</kbd>
            Select
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="sc-kbd">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
