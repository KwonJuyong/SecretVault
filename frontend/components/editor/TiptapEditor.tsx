'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { TextSelection, NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { ResizableImage } from './ResizableImage';
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
  onSaveContent?: (html: string) => Promise<void>;
  subPageTitles?: Record<string, string>;
  subPageIcons?: Record<string, string>;
  pageId?: string | null;
}

export default function TiptapEditor({ content, onChange, onInsertSubPage, onNavigateToPage, onSaveContent, subPageTitles, subPageIcons, pageId }: TiptapEditorProps) {
  const suppressUpdate = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subPageTitlesRef = useRef(subPageTitles);
  const subPageIconsRef = useRef(subPageIcons);
  const prevPageIdRef = useRef<string | null | undefined>(undefined);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const slashStartRef = useRef<number | null>(null);

  // Keep refs in sync
  useEffect(() => { subPageTitlesRef.current = subPageTitles; }, [subPageTitles]);
  useEffect(() => { subPageIconsRef.current = subPageIcons; }, [subPageIcons]);

  const editor = useEditor({
    immediatelyRender: false,
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
      ResizableImage,
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
        // If a subpage atom block is NodeSelected, prevent printable keys and
        // Backspace/Delete from replacing or deleting it. Instead, nudge the
        // cursor to just after the block so the user can keep typing normally.
        const { selection } = view.state;
        if (selection instanceof NodeSelection && selection.node.type.name === 'subPageLink') {
          const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
          if (isPrintable || event.key === 'Backspace' || event.key === 'Delete') {
            const afterPos = selection.$to.pos;
            const resolved = view.state.doc.resolve(afterPos);
            const newSel = TextSelection.near(resolved);
            view.dispatch(view.state.tr.setSelection(newSel));
            return true;
          }
        }

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

  // Sync external content changes into editor only when navigating to a different page.
  // Gating on pageId (not content) prevents overwriting the editor during user edits,
  // which was causing subpage blocks to disappear after typing.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // If same page, this is a round-trip from onChange → parent state → prop. Skip.
    if (pageId === prevPageIdRef.current) return;
    prevPageIdRef.current = pageId;

    let htmlContent = content;
    if (content && !isHtmlContent(content)) {
      htmlContent = markdownToHtml(content);
    }

    requestAnimationFrame(() => {
      if (editor.isDestroyed) return;
      suppressUpdate.current = true;
      editor.commands.setContent(htmlContent || '<p></p>');
      suppressUpdate.current = false;
      // Move cursor to the end so typing doesn't land on (and overwrite) an atom block
      // such as a subpage link that sits at the top of the document.
      editor.commands.focus('end');

      // After setting content, sync sub-page link titles and icons immediately
      try {
        const titles = subPageTitlesRef.current;
        const icons = subPageIconsRef.current;
        if (titles || icons) {
          const { doc } = editor.state;
          const { tr } = editor.state;
          let modified = false;
          doc.descendants((node, pos) => {
            if (node.type.name === 'subPageLink') {
              const newAttrs = { ...node.attrs };
              let changed = false;
              const liveTitle = titles?.[node.attrs.pageId];
              const liveIcon = icons?.[node.attrs.pageId];
              if (liveTitle && liveTitle !== node.attrs.title) { newAttrs.title = liveTitle; changed = true; }
              if (liveIcon !== undefined && liveIcon !== node.attrs.icon) { newAttrs.icon = liveIcon; changed = true; }
              if (changed) { tr.setNodeMarkup(pos, undefined, newAttrs); modified = true; }
            }
          });
          if (modified) {
            suppressUpdate.current = true;
            editor.view.dispatch(tr);
            suppressUpdate.current = false;
          }
        }
      } catch { /* ignore stale transaction errors during navigation */ }
    });
  }, [pageId, content, editor]);

  // Keep sub-page link titles and icons in sync with actual page data
  useEffect(() => {
    if (!editor || editor.isDestroyed || (!subPageTitles && !subPageIcons)) return;
    // Skip sync while a block drag is in progress to avoid stale positions
    if (editor.view.dom.hasAttribute('data-dragging')) return;
    try {
      const { doc } = editor.state;
      const { tr } = editor.state;
      let modified = false;
      doc.descendants((node, pos) => {
        if (node.type.name === 'subPageLink') {
          const newAttrs = { ...node.attrs };
          let changed = false;
          const liveTitle = subPageTitles?.[node.attrs.pageId];
          const liveIcon = subPageIcons?.[node.attrs.pageId];
          if (liveTitle && liveTitle !== node.attrs.title) { newAttrs.title = liveTitle; changed = true; }
          if (liveIcon !== undefined && liveIcon !== node.attrs.icon) { newAttrs.icon = liveIcon; changed = true; }
          if (changed) { tr.setNodeMarkup(pos, undefined, newAttrs); modified = true; }
        }
      });
      if (modified) {
        suppressUpdate.current = true;
        editor.view.dispatch(tr);
        suppressUpdate.current = false;
      }
    } catch { /* ignore stale transaction errors during navigation */ }
  }, [editor, subPageTitles, subPageIcons]);

  const handleInsertImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      editor.chain().focus().insertContent({ type: 'image', attrs: { src: base64 } }).run();
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
        // Save the cursor position BEFORE the async API call
        const insertPos = editor.state.selection.from;
        const created = await onInsertSubPage?.();
        if (created) {
          // Insert link at the exact saved position (not wherever cursor drifted)
          editor.chain().focus().insertContentAt(insertPos, {
            type: 'subPageLink',
            attrs: { pageId: created.id, title: created.title || 'Untitled' },
          }).run();
          // Save parent page WITH the link before navigating away
          const updatedHtml = editor.getHTML();
          onChange(updatedHtml);
          if (onSaveContent) {
            await onSaveContent(updatedHtml);
          }
          onNavigateToPage?.(created.id);
        }
        break;
      }
    }

    setSlashOpen(false);
    slashStartRef.current = null;
  }, [editor, onInsertSubPage, onChange, onSaveContent]);

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
        <div className="flex items-center gap-2 px-8 py-2.5 border-b border-neutral-100 dark:border-neutral-800/60 bg-[rgb(247,246,243)] dark:bg-[#2f3437] text-sm flex-wrap">
          <span className="text-neutral-400 mr-2 font-medium">Table</span>
          <button onClick={() => editor.chain().focus().addColumnBefore().run()} className="px-3 py-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition">+ Col Before</button>
          <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-3 py-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition">+ Col After</button>
          <button onClick={() => editor.chain().focus().addRowBefore().run()} className="px-3 py-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition">+ Row Before</button>
          <button onClick={() => editor.chain().focus().addRowAfter().run()} className="px-3 py-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition">+ Row After</button>
          <div className="w-px h-4 bg-neutral-200/60 dark:bg-neutral-700/50 mx-0.5" />
          <button onClick={() => editor.chain().focus().toggleHeaderRow().run()} className="px-3 py-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition">Header Row</button>
          <button onClick={() => editor.chain().focus().mergeCells().run()} className="px-3 py-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition">Merge</button>
          <button onClick={() => editor.chain().focus().splitCell().run()} className="px-3 py-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition">Split</button>
          <div className="w-px h-4 bg-neutral-200/60 dark:bg-neutral-700/50 mx-0.5" />
          <button onClick={() => editor.chain().focus().deleteColumn().run()} className="px-3 py-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition">- Col</button>
          <button onClick={() => editor.chain().focus().deleteRow().run()} className="px-3 py-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition">- Row</button>
          <button onClick={() => editor.chain().focus().deleteTable().run()} className="px-3 py-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition">Delete</button>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto bg-white dark:bg-[#191919]"
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
        <div className="max-w-[900px] mx-auto px-8 sm:px-14 lg:px-16 py-8 pb-[50vh]">
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
