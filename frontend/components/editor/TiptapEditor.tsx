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
import EditorToolbar from './EditorToolbar';
import SlashMenu, { BlockType } from './SlashMenu';
import { isHtmlContent, markdownToHtml } from '@/lib/markdown';

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  onInsertSubPage?: () => void;
}

export default function TiptapEditor({ content, onChange, onInsertSubPage }: TiptapEditorProps) {
  const suppressUpdate = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Slash menu state
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const slashStartRef = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
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
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap-content outline-none min-h-[70vh] px-8 sm:px-16 lg:px-24 py-8',
      },
      handleKeyDown: (view, event) => {
        // Detect `/` at start of empty line to open slash menu
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
              } catch {
                // ignore if pos is invalid
              }
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

      // Track slash filter text
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

  // Handle slash menu command selection
  const handleSlashSelect = useCallback((type: BlockType) => {
    if (!editor || slashStartRef.current === null) return;

    // Delete the `/filter` text
    try {
      const { from } = editor.state.selection;
      const start = slashStartRef.current;
      if (start >= 0 && from >= start) {
        editor.chain().focus().deleteRange({ from: start, to: from }).run();
      }
    } catch {
      // ignore
    }

    // Execute the command
    switch (type) {
      case 'paragraph':
        editor.chain().focus().setParagraph().run();
        break;
      case 'h1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'h2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'h3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'bullet':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'numbered':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'todo':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'quote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'code':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'divider':
        editor.chain().focus().setHorizontalRule().run();
        break;
      case 'table':
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case 'image':
        fileInputRef.current?.click();
        break;
      case 'subpage':
        onInsertSubPage?.();
        break;
    }

    setSlashOpen(false);
    slashStartRef.current = null;
  }, [editor, onInsertSubPage]);

  const handleSlashClose = useCallback(() => {
    setSlashOpen(false);
    slashStartRef.current = null;
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <EditorToolbar editor={editor} onInsertImage={handleInsertImage} />
      {editor?.isActive('table') && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-neutral-100 bg-neutral-50 text-xs">
          <span className="text-neutral-400 mr-2">Table:</span>
          <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-2 py-0.5 rounded hover:bg-neutral-200 text-neutral-600">+ Column</button>
          <button onClick={() => editor.chain().focus().addRowAfter().run()} className="px-2 py-0.5 rounded hover:bg-neutral-200 text-neutral-600">+ Row</button>
          <button onClick={() => editor.chain().focus().deleteColumn().run()} className="px-2 py-0.5 rounded hover:bg-red-50 text-red-500">- Column</button>
          <button onClick={() => editor.chain().focus().deleteRow().run()} className="px-2 py-0.5 rounded hover:bg-red-50 text-red-500">- Row</button>
          <button onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-0.5 rounded hover:bg-red-50 text-red-500">Delete Table</button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-neutral-950">
        <EditorContent editor={editor} />
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Slash command menu */}
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
