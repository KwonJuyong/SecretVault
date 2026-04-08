'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useState, useEffect } from 'react';
import { AlignLeft, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface TocEntry {
  id: string;
  level: number;
  text: string;
}

function TableOfContentsView({ editor, deleteNode }: any) {
  const [headings, setHeadings] = useState<TocEntry[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    const syncHeadings = () => {
      const els = editor.view.dom.querySelectorAll('h1, h2, h3');
      const hs: TocEntry[] = [];
      els.forEach((el: HTMLElement, idx: number) => {
        const text = el.textContent?.trim() || '';
        if (text) {
          const id = el.id || `toc-${idx}`;
          hs.push({ id, level: parseInt(el.tagName[1]), text });
        }
      });
      setHeadings(hs);
    };

    syncHeadings();
    editor.on('update', syncHeadings);
    return () => editor.off('update', syncHeadings);
  }, [editor]);

  return (
    <NodeViewWrapper contentEditable={false}>
      <div className="toc-block group/toc">
        <div className="toc-block-header">
          <AlignLeft size={13} />
          <span className="toc-block-title-text">{t.tocLabel}</span>
          <button
            onClick={() => deleteNode()}
            className="toc-block-delete opacity-0 group-hover/toc:opacity-100"
            title="Remove"
          >
            <X size={13} />
          </button>
        </div>
        {headings.length === 0 ? (
          <p className="toc-block-empty">{t.tocEmpty}</p>
        ) : (
          <div className="toc-block-list">
            {headings.map(h => (
              <button
                key={h.id + h.text}
                onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`toc-block-item toc-level-${h.level}`}
                style={{ paddingLeft: `${(h.level - 1) * 16 + 10}px` }}
              >
                {h.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const TableOfContentsNode = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="table-of-contents"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'table-of-contents',
        class: 'toc-block-placeholder',
      }),
      'Table of Contents',
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableOfContentsView);
  },
});
