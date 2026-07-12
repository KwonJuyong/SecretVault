'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type * as Y from 'yjs';
import TiptapEditor from './TiptapEditor';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TocHeading } from '@/lib/types';


interface EditorProps {
  title: string;
  /** Only used to seed a pre-CRDT page into its new Yjs document; otherwise the doc wins. */
  content: string;
  icon: string;
  pageId?: string | null;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onChangeIcon: (icon: string) => void;
  onCreateSubPage?: () => Promise<{ id: string; title: string } | undefined>;
  onNavigateToPage?: (pageId: string) => void;
  subPageTitles?: Record<string, string>;
  subPageIcons?: Record<string, string>;
  onHeadingsChange?: (headings: TocHeading[]) => void;
  ydoc?: Y.Doc | null;
}

const emojiCategories = [
  {
    name: 'Minimal',
    emojis: [
      '◆', '◇', '●', '○', '■', '□', '▲', '△', '▼', '▽',
      '◯', '⬡', '★', '☆', '✦', '✱', '✶', '✸', '※', '§',
      '→', '←', '↑', '↓', '↔', '↩', '↺', '⇒', '∞', '⊕',
      '✓', '✗', '✚', '⋯', '‥', '—', '¶', '†', '‡', '◉',
    ],
  },
  {
    name: 'Common',
    emojis: ['', '\u{1F4DD}', '\u{1F4CB}', '\u{1F4D6}', '\u{1F4DA}', '\u{1F4A1}', '\u{1F680}', '\u2B50', '\u{1F525}', '\u{1F4E6}', '\u{1F50D}', '\u{1F512}', '\u{1F3AF}', '\u2705', '\u26A0\uFE0F', '\u{1F4AC}', '\u{1F4BB}', '\u{1F9EA}', '\u{1F4CA}', '\u{1F4C1}'],
  },
  {
    name: 'Objects',
    emojis: ['\u{1F4CC}', '\u{1F4CE}', '\u{1F4D1}', '\u{1F4D2}', '\u{1F4D3}', '\u{1F4D4}', '\u{1F4D5}', '\u{1F4D7}', '\u{1F4D8}', '\u{1F4D9}', '\u{1F4DC}', '\u{1F4E7}', '\u{1F4E8}', '\u{1F4E9}', '\u{1F4EA}', '\u2709\uFE0F', '\u{1F4F0}', '\u{1F5DE}\uFE0F', '\u{1F4F1}', '\u{1F5A5}\uFE0F'],
  },
  {
    name: 'People',
    emojis: ['\u{1F464}', '\u{1F465}', '\u{1F468}\u200D\u{1F4BB}', '\u{1F469}\u200D\u{1F4BB}', '\u{1F9D1}\u200D\u{1F4BC}', '\u{1F4AA}', '\u{1F44D}', '\u{1F44E}', '\u{1F44F}', '\u{1F91D}', '\u270C\uFE0F', '\u{1F64F}', '\u{1F914}', '\u{1F4AD}', '\u{1F4A4}', '\u{1F389}', '\u{1F38A}', '\u{1F381}', '\u{1F3C6}', '\u{1F3C5}'],
  },
  {
    name: 'Nature',
    emojis: ['\u{1F31F}', '\u2600\uFE0F', '\u{1F324}\uFE0F', '\u{1F327}\uFE0F', '\u26A1', '\u{1F308}', '\u{1F33B}', '\u{1F33A}', '\u{1F337}', '\u{1F331}', '\u{1F332}', '\u{1F333}', '\u{1F335}', '\u{1F340}', '\u{1F341}', '\u{1F34E}', '\u{1F34A}', '\u{1F353}', '\u{1F352}', '\u{1F349}'],
  },
  {
    name: 'Symbols',
    emojis: ['\u2764\uFE0F', '\u{1F499}', '\u{1F49A}', '\u{1F49B}', '\u{1F49C}', '\u{1F90D}', '\u{1F5A4}', '\u{1F4AF}', '\u{1F4A5}', '\u{1F4AB}', '\u2728', '\u{1F6A9}', '\u{1F3F3}\uFE0F', '\u{1F6D1}', '\u267B\uFE0F', '\u2757', '\u2753', '\u{1F198}', '\u{1F195}', '\u{1F51D}'],
  },
  {
    name: 'Animals',
    emojis: ['\u{1F436}', '\u{1F431}', '\u{1F42D}', '\u{1F439}', '\u{1F430}', '\u{1F98A}', '\u{1F43B}', '\u{1F43C}', '\u{1F428}', '\u{1F42F}', '\u{1F981}', '\u{1F984}', '\u{1F422}', '\u{1F40D}', '\u{1F433}', '\u{1F419}', '\u{1F99E}', '\u{1F41D}', '\u{1F98B}', '\u{1F426}'],
  },
];

export default function Editor({
  title, content, icon, pageId,
  onChangeTitle, onChangeContent, onChangeIcon,
  onCreateSubPage, onNavigateToPage,
  subPageTitles, subPageIcons,
  onHeadingsChange, ydoc,
}: EditorProps) {
  const { t } = useLanguage();
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const titleRef = useRef<HTMLInputElement>(null);

  // Auto-focus title when loading an empty/new page
  useEffect(() => {
    if (title === '' || title === 'Untitled' || title === t.untitled) {
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [title]);

  const handleContentChange = useCallback((html: string) => {
    onChangeContent(html);
  }, [onChangeContent]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-surface)]">
      {/* Title area - centered with max-width */}
      <div className="w-full">
        <div className="max-w-[960px] xl:max-w-[1100px] 2xl:max-w-[1250px] mx-auto px-8 sm:px-14 lg:px-16 pt-10 pb-3">
          {/* Icon picker */}
          <div className="relative mb-3 inline-block">
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="text-[56px] leading-none hover:bg-[var(--bg-hover)] rounded-xl p-2 transition-colors"
              title={t.changeIcon}
            >
              {icon || '\u{1F4C4}'}
            </button>
            {showIconPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowIconPicker(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--bg-surface)] rounded-xl shadow-[var(--shadow-xl)] border border-[var(--border-default)] w-80 overflow-hidden animate-scale-in origin-top-left">
                  <div className="flex gap-0.5 px-2 pt-2 pb-1 overflow-x-auto border-b border-[var(--border-subtle)]">
                    {emojiCategories.map((cat, i) => (
                      <button
                        key={cat.name}
                        onClick={() => setActiveCategory(i)}
                        className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium whitespace-nowrap transition-colors ${
                          i === activeCategory
                            ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                            : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  <div className="p-2 grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                    {emojiCategories[activeCategory].emojis.map((emoji, i) => (
                      <button
                        key={i}
                        onClick={() => { onChangeIcon(emoji); setShowIconPicker(false); }}
                        className="text-[18px] w-8 h-8 rounded-md hover:bg-[var(--bg-hover)] transition flex items-center justify-center"
                      >
                        {emoji || '\u274C'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Title input */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={e => onChangeTitle(e.target.value)}
            placeholder={t.untitled}
            className="w-full text-[40px] font-bold tracking-tight text-[var(--fg-primary)] bg-transparent border-none outline-none placeholder-[var(--fg-quaternary)] leading-tight"
          />
        </div>
      </div>

      {/* Editor content */}
      <TiptapEditor
        content={content}
        onChange={handleContentChange}
        onInsertSubPage={onCreateSubPage}
        onNavigateToPage={onNavigateToPage}
        subPageTitles={subPageTitles}
        subPageIcons={subPageIcons}
        pageId={pageId}
        onHeadingsChange={onHeadingsChange}
        ydoc={ydoc}
      />

      {/* Sub-pages are shown inline in editor via SubPageNode */}
    </div>
  );
}
