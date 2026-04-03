'use client';

import { Editor } from '@tiptap/react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Bold, Italic, Underline, Strikethrough, Code,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare,
  Quote, CodeSquare, Minus,
  Table, Image, Undo2, Redo2,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  onInsertImage: () => void;
}

export default function EditorToolbar({ editor, onInsertImage }: EditorToolbarProps) {
  const { t } = useLanguage();

  if (!editor) return null;

  const Btn = ({ active, onClick, children, title }: {
    active?: boolean; onClick: () => void; children: React.ReactNode; title?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2.5 rounded-lg transition-colors duration-150 ${
        active
          ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-500 dark:text-violet-300'
          : 'text-neutral-500 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
  );

  const Sep = () => <div className="w-px h-5 bg-neutral-200/50 dark:bg-neutral-700/50 mx-1" />;

  return (
    <div className="flex items-center gap-0.5 px-8 py-2.5 border-b border-neutral-100 dark:border-neutral-800/60 bg-white dark:bg-[#202020] flex-wrap flex-shrink-0">
      <Btn onClick={() => editor.chain().focus().undo().run()} title={t.undo}><Undo2 size={19} /></Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} title={t.redo}><Redo2 size={19} /></Btn>
      <Sep />
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title={t.bold}><Bold size={19} /></Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title={t.italic}><Italic size={19} /></Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title={t.underline}><Underline size={19} /></Btn>
      <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title={t.strikethrough}><Strikethrough size={19} /></Btn>
      <Btn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title={t.inlineCode}><Code size={19} /></Btn>
      <Sep />
      <Btn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title={t.heading1}><Heading1 size={19} /></Btn>
      <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title={t.heading2}><Heading2 size={19} /></Btn>
      <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title={t.heading3}><Heading3 size={19} /></Btn>
      <Sep />
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title={t.bulletList}><List size={19} /></Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title={t.numberedList}><ListOrdered size={19} /></Btn>
      <Btn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title={t.taskList}><CheckSquare size={19} /></Btn>
      <Sep />
      <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title={t.quote}><Quote size={19} /></Btn>
      <Btn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title={t.codeBlock}><CodeSquare size={19} /></Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title={t.divider}><Minus size={19} /></Btn>
      <Sep />
      <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title={t.insertTable}><Table size={19} /></Btn>
      <Btn onClick={onInsertImage} title={t.insertImage}><Image size={19} /></Btn>
    </div>
  );
}
