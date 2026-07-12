'use client';

import { Editor } from '@tiptap/react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Bold, Italic, Underline, Strikethrough, Code,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare,
  Quote, CodeSquare, Minus,
  Table, Image as ImageIcon, Undo2, Redo2,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  onInsertImage: () => void;
}

// Defined at module scope, not inside the component. A component declared in a render body
// is a brand-new type on every render, so React unmounts and remounts every button each
// time the toolbar re-renders — which it does on every keystroke, to update `isActive`.
function Btn({ active, onClick, children, title }: {
  active?: boolean; onClick: () => void; children: React.ReactNode; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
        active
          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]'
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-[var(--border-subtle)] mx-1" />;
}

export default function EditorToolbar({ editor, onInsertImage }: EditorToolbarProps) {
  const { t } = useLanguage();

  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 px-6 h-11 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex-wrap flex-shrink-0">
      <Btn onClick={() => editor.chain().focus().undo().run()} title={t.undo}><Undo2 size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} title={t.redo}><Redo2 size={15} /></Btn>
      <Sep />
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title={t.bold}><Bold size={15} /></Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title={t.italic}><Italic size={15} /></Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title={t.underline}><Underline size={15} /></Btn>
      <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title={t.strikethrough}><Strikethrough size={15} /></Btn>
      <Btn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title={t.inlineCode}><Code size={15} /></Btn>
      <Sep />
      <Btn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title={t.heading1}><Heading1 size={15} /></Btn>
      <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title={t.heading2}><Heading2 size={15} /></Btn>
      <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title={t.heading3}><Heading3 size={15} /></Btn>
      <Sep />
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title={t.bulletList}><List size={15} /></Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title={t.numberedList}><ListOrdered size={15} /></Btn>
      <Btn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title={t.taskList}><CheckSquare size={15} /></Btn>
      <Sep />
      <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title={t.quote}><Quote size={15} /></Btn>
      <Btn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title={t.codeBlock}><CodeSquare size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title={t.divider}><Minus size={15} /></Btn>
      <Sep />
      <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title={t.insertTable}><Table size={15} /></Btn>
      <Btn onClick={onInsertImage} title={t.insertImage}><ImageIcon size={15} /></Btn>
    </div>
  );
}
