'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import EditorToolbar from './EditorToolbar';
import CodeBlockToolbar from './CodeBlockView';
import SlashMenu, { BlockType } from './SlashMenu';
import { MathInline, MathBlock } from './MathExtension';
import { SubPageNode } from './SubPageNode';
import { DragHandle } from './DragHandle';
import { isHtmlContent, markdownToHtml } from '@/lib/markdown';

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  onInsertSubPage?: () => Promise<{ id: string; title: string } | undefined>;
  onNavigateToPage?: (pageId: string) => void;
}

export default function TiptapEditor({ content, onChange, onInsertSubPage, onNavigateToPage }: TiptapEditorProps) {
  const suppressUpdate = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const slashStartRef = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Type / for commands...',
        showOnlyCurrent: true,
        showOnlyWhenEditable: true,
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      MathInline,
      MathBlock,
      SubPageNode,
      DragHandle,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap-content outline-none',
      },
      scrollThreshold: 100,
      scrollMargin: 80,
      handleKeyDown: (view, event) => {
        if (event.key === '/' && !slashOpen) {
          const { $from } = view.state.selection;
          const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
          if (textBefore === '') {
            const pos = $from.pos;
            setTimeout(() => {
              try {
                const coords = view.coordsAtPos(pos);
                setSlashPos({ top: coords.bottom + 6, left: coords.left });
                setSlashOpen(true);
                setSlashFilter('');
                slashStartRef.current = pos;
              } catch { /* ignore */ }
            }, 0);
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return false;
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = e.target?.result as string;
              view.dispatch(
                view.state.tr.replaceSelectionWith(
                  view.state.schema.nodes.image.create({ src: base64 })
                )
              );
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = e.target?.result as string;
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (pos) {
                view.dispatch(
                  view.state.tr.insert(pos.pos, view.state.schema.nodes.image.create({ src: base64 }))
                );
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (suppressUpdate.current) return;

      if (slashOpen && slashStartRef.current !== null) {
        try {
          const { from } = editor.state.selection;
          const docSize = editor.state.doc.content.size;
          const start = slashStartRef.current;
          if (start >= 0 && from <= docSize && from >= start) {
            const text = editor.state.doc.textBetween(start, from, '');
            if (text.startsWith('/')) {
              setSlashFilter(text.slice(1));
            } else {
              setSlashOpen(false);
              slashStartRef.current = null;
            }
          } else {
            setSlashOpen(false);
            slashStartRef.current = null;
          }
        } catch {
          setSlashOpen(false);
          slashStartRef.current = null;
        }
      }

      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    let htmlContent = content;
    if (content && !isHtmlContent(content)) {
      htmlContent = markdownToHtml(content);
    }
    const currentHtml = editor.getHTML();
    if (htmlContent !== currentHtml) {
      suppressUpdate.current = true;
      editor.commands.setContent(htmlContent || '<p></p>');
      suppressUpdate.current = false;
    }
  }, [content, editor]);

  const handleInsertImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      editor.chain().focus().setImage({ src: base64 }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [editor]);

  const handleSlashSelect = useCallback(async (type: BlockType) => {
    if (!editor || slashStartRef.current === null) return;

    try {
      const { from } = editor.state.selection;
      const start = slashStartRef.current;
      if (start >= 0 && from >= start) {
        editor.chain().focus().deleteRange({ from: start, to: from }).run();
      }
    } catch { /* ignore */ }

    switch (type) {
      case 'paragraph': editor.chain().focus().setParagraph().run(); break;
      case 'h1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
      case 'h2': editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
      case 'h3': editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
      case 'bullet': editor.chain().focus().toggleBulletList().run(); break;
      case 'numbered': editor.chain().focus().toggleOrderedList().run(); break;
      case 'todo': editor.chain().focus().toggleTaskList().run(); break;
      case 'quote': editor.chain().focus().toggleBlockquote().run(); break;
      case 'code': editor.chain().focus().toggleCodeBlock().run(); break;
      case 'divider': editor.chain().focus().setHorizontalRule().run(); break;
      case 'table': editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
      case 'image': fileInputRef.current?.click(); break;
      case 'mathInline': editor.chain().focus().insertContent({ type: 'mathInline', attrs: { latex: '' } }).run(); break;
      case 'mathBlock': editor.chain().focus().insertContent({ type: 'mathBlock', attrs: { latex: '' } }).run(); break;
      case 'subpage': {
        onChange(editor.getHTML());
        const created = await onInsertSubPage?.();
        if (created) {
          editor.chain().focus().insertContent({
            type: 'subPageLink',
            attrs: { pageId: created.id, title: created.title || 'Untitled' },
          }).run();
        }
        break;
      }
    }

    setSlashOpen(false);
    slashStartRef.current = null;
  }, [editor, onInsertSubPage, onChange]);

  const handleSlashClose = useCallback(() => {
    setSlashOpen(false);
    slashStartRef.current = null;
  }, []);

  const isTableActive = editor?.isActive('table') ?? false;
  const isCodeBlockActive = editor?.isActive('codeBlock') ?? false;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <EditorToolbar editor={editor} onInsertImage={handleInsertImage} />

      {/* Code block language selector */}
      {isCodeBlockActive && editor && <CodeBlockToolbar editor={editor} />}

      {/* Table controls */}
      {isTableActive && editor && (
        <div className="flex items-center gap-1 px-5 py-1.5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs flex-wrap">
          <span className="text-neutral-400 mr-2">Table:</span>
          <button onClick={() => editor.chain().focus().addColumnBefore().run()} className="px-2 py-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300">+ Col Before</button>
          <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-2 py-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300">+ Col After</button>
          <button onClick={() => editor.chain().focus().addRowBefore().run()} className="px-2 py-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300">+ Row Before</button>
          <button onClick={() => editor.chain().focus().addRowAfter().run()} className="px-2 py-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300">+ Row After</button>
          <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mx-1" />
          <button onClick={() => editor.chain().focus().toggleHeaderRow().run()} className="px-2 py-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300">Header Row</button>
          <button onClick={() => editor.chain().focus().mergeCells().run()} className="px-2 py-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300">Merge</button>
          <button onClick={() => editor.chain().focus().splitCell().run()} className="px-2 py-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300">Split</button>
          <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mx-1" />
          <button onClick={() => editor.chain().focus().deleteColumn().run()} className="px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">- Col</button>
          <button onClick={() => editor.chain().focus().deleteRow().run()} className="px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">- Row</button>
          <button onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">Delete</button>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto bg-white dark:bg-neutral-950"
        onClick={e => {
          const target = (e.target as HTMLElement).closest('[data-subpage-id]');
          if (target) {
            const pageId = target.getAttribute('data-subpage-id');
            if (pageId && onNavigateToPage) {
              e.preventDefault();
              onNavigateToPage(pageId);
            }
          }
        }}
      >
        <div className="max-w-[900px] mx-auto px-6 sm:px-12 lg:px-16 py-6 pb-[50vh]">
          <EditorContent editor={editor} />
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {slashOpen && (
        <SlashMenu
          filter={slashFilter}
          position={slashPos}
          onSelect={handleSlashSelect}
          onClose={handleSlashClose}
        />
      )}
    </div>
  );
}
