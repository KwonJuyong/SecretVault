'use client';

import { useState } from 'react';
import { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import {
  Trash2, Copy, ChevronLeft, ChevronRight,
  Type, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Code2,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface BlockMenuProps {
  pos: number;
  anchorRect: { top: number; right: number; bottom: number; left: number };
  blockType: string;
  editor: Editor;
  onClose: () => void;
}

// Block types that support "Turn into"
const TEXT_BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock',
]);

const TURN_INTO_OPTIONS = [
  { type: 'paragraph', icon: <Type size={16} />, labelKey: 'textLabel' as const },
  { type: 'h1', icon: <Heading1 size={16} />, labelKey: 'h1Label' as const },
  { type: 'h2', icon: <Heading2 size={16} />, labelKey: 'h2Label' as const },
  { type: 'h3', icon: <Heading3 size={16} />, labelKey: 'h3Label' as const },
  { type: 'bullet', icon: <List size={16} />, labelKey: 'bulletLabel' as const },
  { type: 'numbered', icon: <ListOrdered size={16} />, labelKey: 'numberedLabel' as const },
  { type: 'todo', icon: <CheckSquare size={16} />, labelKey: 'todoLabel' as const },
  { type: 'quote', icon: <Quote size={16} />, labelKey: 'quoteLabel' as const },
  { type: 'code', icon: <Code2 size={16} />, labelKey: 'codeLabel' as const },
];

export default function BlockMenu({ pos, anchorRect, blockType, editor, onClose }: BlockMenuProps) {
  const { t } = useLanguage();
  const [panel, setPanel] = useState<'main' | 'turnInto'>('main');

  const canTurnInto = TEXT_BLOCK_TYPES.has(blockType);

  // Position: right of the handle, vertically aligned with it
  const menuW = 200;
  const menuH = panel === 'turnInto' ? 320 : canTurnInto ? 120 : 84;
  const margin = 8;

  let left = anchorRect.right + 6;
  let top = anchorRect.top;

  if (left + menuW > window.innerWidth - margin) {
    left = anchorRect.left - menuW - 6;
  }
  if (left < margin) left = margin;
  if (top + menuH > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - menuH - margin);
  }

  // Focus the block (set text selection inside it) then apply command
  const focusBlock = () => {
    try {
      const node = editor.state.doc.nodeAt(pos);
      if (!node) return;
      const resolved = editor.state.doc.resolve(pos + 1);
      const sel = TextSelection.near(resolved);
      editor.view.dispatch(editor.state.tr.setSelection(sel));
    } catch { /* ignore */ }
  };

  const handleDelete = () => {
    try {
      const node = editor.state.doc.nodeAt(pos);
      if (!node) return;
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
    } catch { /* ignore */ }
    onClose();
  };

  const handleDuplicate = () => {
    try {
      const node = editor.state.doc.nodeAt(pos);
      if (!node) return;
      const endPos = pos + node.nodeSize;
      editor.chain().focus().insertContentAt(endPos, node.toJSON()).run();
    } catch { /* ignore */ }
    onClose();
  };

  const handleTurnInto = (type: string) => {
    focusBlock();
    switch (type) {
      case 'paragraph': editor.chain().focus().setParagraph().run(); break;
      case 'h1': editor.chain().focus().setHeading({ level: 1 }).run(); break;
      case 'h2': editor.chain().focus().setHeading({ level: 2 }).run(); break;
      case 'h3': editor.chain().focus().setHeading({ level: 3 }).run(); break;
      case 'bullet': editor.chain().focus().toggleBulletList().run(); break;
      case 'numbered': editor.chain().focus().toggleOrderedList().run(); break;
      case 'todo': editor.chain().focus().toggleTaskList().run(); break;
      case 'quote': editor.chain().focus().toggleBlockquote().run(); break;
      case 'code': editor.chain().focus().toggleCodeBlock().run(); break;
    }
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-[var(--bg-surface)] rounded-xl shadow-[var(--shadow-xl)] border border-[var(--border-default)] overflow-hidden animate-scale-in origin-top-left"
        style={{ top, left, width: menuW }}
      >
        {panel === 'main' ? (
          <div className="p-1">
            {canTurnInto && (
              <button
                onClick={() => setPanel('turnInto')}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[13px] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <span>{t.blockMenuTurnInto}</span>
                <ChevronRight size={13} className="text-[var(--fg-tertiary)]" />
              </button>
            )}
            <button
              onClick={handleDuplicate}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Copy size={14} className="text-[var(--fg-tertiary)]" />
              {t.blockMenuDuplicate}
            </button>
            <div className="my-1 border-t border-[var(--border-subtle)]" />
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors"
            >
              <Trash2 size={14} />
              {t.blockMenuDelete}
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <button
              onClick={() => setPanel('main')}
              className="flex items-center gap-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] border-b border-[var(--border-subtle)] transition-colors"
            >
              <ChevronLeft size={12} />
              {t.blockMenuBack}
            </button>
            <div className="p-1 max-h-64 overflow-y-auto">
              {TURN_INTO_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => handleTurnInto(opt.type)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-[var(--fg-primary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] transition-colors"
                >
                  <span className="text-[var(--fg-tertiary)]">{opt.icon}</span>
                  {t[opt.labelKey]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
