'use client';

import { Editor } from '@tiptap/react';
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
  if (!editor) return null;

  const Btn = ({ active, onClick, children, title }: {
    active?: boolean; onClick: () => void; children: React.ReactNode; title?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg transition-colors duration-150 ${
        active
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
          : 'text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
  );

  const Sep = () => <div className="w-px h-5 bg-neutral-200/50 dark:bg-neutral-700/50 mx-0.5" />;

  return (
    <div className="flex items-center gap-0.5 px-6 py-2 border-b border-neutral-100 dark:border-neutral-800/60 bg-white dark:bg-[#202020] flex-wrap flex-shrink-0">
      <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo2 size={17} /></Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo2 size={17} /></Btn>
      <Sep />
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)"><Bold size={17} /></Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)"><Italic size={17} /></Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)"><Underline size={17} /></Btn>
      <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><Strikethrough size={17} /></Btn>
      <Btn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline Code"><Code size={17} /></Btn>
      <Sep />
      <Btn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1"><Heading1 size={17} /></Btn>
      <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2"><Heading2 size={17} /></Btn>
      <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3"><Heading3 size={17} /></Btn>
      <Sep />
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List"><List size={17} /></Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List"><ListOrdered size={17} /></Btn>
      <Btn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task List"><CheckSquare size={17} /></Btn>
      <Sep />
      <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote"><Quote size={17} /></Btn>
      <Btn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block"><CodeSquare size={17} /></Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus size={17} /></Btn>
      <Sep />
      <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table"><Table size={17} /></Btn>
      <Btn onClick={onInsertImage} title="Insert Image"><Image size={17} /></Btn>
    </div>
  );
}
