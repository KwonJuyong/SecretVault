'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { TextSelection, NodeSelection } from '@tiptap/pm/state';
import { addRowAfter } from '@tiptap/pm/tables';
import { trailingNode } from '@tiptap/pm/trailing-node';
import { Extension } from '@tiptap/core';
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
import BlockMenu from './BlockMenu';
import { MathInline, MathBlock } from './MathExtension';
import { SubPageNode } from './SubPageNode';
import { TableOfContentsNode } from './TableOfContentsNode';
import { DragHandle } from './DragHandle';
import IMECompositionFix from './IMECompositionFix';
import { isHtmlContent, markdownToHtml } from '@/lib/markdown';
import type { TocHeading } from '@/lib/types';

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
  onHeadingsChange?: (headings: TocHeading[]) => void;
}

export default function TiptapEditor({ content, onChange, onInsertSubPage, onNavigateToPage, onSaveContent, subPageTitles, subPageIcons, pageId, onHeadingsChange }: TiptapEditorProps) {
  const suppressUpdate = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subPageTitlesRef = useRef(subPageTitles);
  const subPageIconsRef = useRef(subPageIcons);
  const prevPageIdRef = useRef<string | null | undefined>(undefined);
  const onHeadingsChangeRef = useRef(onHeadingsChange);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashPos, setSlashPos] = useState({ top: 0, lineTop: 0, left: 0 });
  const slashStartRef = useRef<number | null>(null);

  const [blockMenu, setBlockMenu] = useState<{
    pos: number;
    rect: { top: number; right: number; bottom: number; left: number };
    blockType: string;
  } | null>(null);

  // Keep refs in sync
  useEffect(() => { subPageTitlesRef.current = subPageTitles; }, [subPageTitles]);
  useEffect(() => { subPageIconsRef.current = subPageIcons; }, [subPageIcons]);
  useEffect(() => { onHeadingsChangeRef.current = onHeadingsChange; }, [onHeadingsChange]);

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
      TableOfContentsNode,
      DragHandle,
      IMECompositionFix,
      // Always keep a trailing empty paragraph so blocks can be dropped at the end
      Extension.create({
        name: 'trailingParagraph',
        addProseMirrorPlugins() {
          return [trailingNode({ nodeName: 'paragraph', ignoredNodes: [] })];
        },
      }),
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

        // Ctrl+Enter inside table: add row below current row
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          const { $from } = view.state.selection;
          let inTable = false;
          for (let d = $from.depth; d >= 0; d--) {
            if ($from.node(d).type.name === 'table') { inTable = true; break; }
          }
          if (inTable && addRowAfter(view.state, view.dispatch)) {
            event.preventDefault();
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
                setSlashPos({ top: coords.bottom + 6, lineTop: coords.top, left: coords.left });
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

      // Sync heading IDs and emit TOC
      requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        const headingEls = editor.view.dom.querySelectorAll('h1, h2, h3');
        const headings: TocHeading[] = [];
        headingEls.forEach((el, idx) => {
          const text = el.textContent?.trim() || '';
          if (text) {
            const id = `toc-${idx}`;
            (el as HTMLElement).id = id;
            headings.push({ id, level: parseInt(el.tagName[1]), text });
          }
        });
        onHeadingsChangeRef.current?.(headings);
      });
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

      // Sync heading IDs after page load
      const headingEls = editor.view.dom.querySelectorAll('h1, h2, h3');
      const headings: TocHeading[] = [];
      headingEls.forEach((el, idx) => {
        const text = el.textContent?.trim() || '';
        if (text) {
          const id = `toc-${idx}`;
          (el as HTMLElement).id = id;
          headings.push({ id, level: parseInt(el.tagName[1]), text });
        }
      });
      onHeadingsChangeRef.current?.(headings);
    });
  }, [pageId, content, editor]);

  // Listen for block context menu events dispatched by DragHandle
  useEffect(() => {
    if (!editor) return;
    const handler = (e: Event) => {
      setBlockMenu((e as CustomEvent).detail);
    };
    editor.view.dom.addEventListener('block-menu-open', handler);
    return () => editor.view.dom.removeEventListener('block-menu-open', handler);
  }, [editor]);

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

    setSlashOpen(false);

    // Delete the "/" and any filter text typed after it
    let deleteOk = false;
    try {
      const { from } = editor.state.selection;
      const start = slashStartRef.current;
      const docSize = editor.state.doc.content.size;
      if (start >= 0 && from >= start && from <= docSize) {
        editor.chain().focus().deleteRange({ from: start, to: from }).run();
        deleteOk = true;
      }
    } catch { /* ignore */ }

    if (!deleteOk) {
      slashStartRef.current = null;
      return;
    }

    slashStartRef.current = null;

    // Block-level nodes that must be placed outside table cells
    const MUST_EXIT_TABLE = new Set(['table', 'divider', 'toc', 'mathBlock', 'image', 'subpage']);

    // If inside a table cell, exit to after the table before inserting block nodes
    if (MUST_EXIT_TABLE.has(type) && editor.isActive('table')) {
      const { $from } = editor.state.selection;
      for (let d = $from.depth; d >= 0; d--) {
        if ($from.node(d).type.name === 'table') {
          const afterTable = $from.after(d);
          // Ensure there's a paragraph after the table to receive the cursor
          const docAfter = editor.state.doc.resolve(Math.min(afterTable, editor.state.doc.content.size));
          if (!docAfter.nodeAfter || docAfter.nodeAfter.type.name !== 'paragraph') {
            editor.view.dispatch(
              editor.state.tr.insert(afterTable, editor.state.schema.nodes.paragraph.create())
            );
          }
          // Move cursor to the paragraph after the table
          const newResolved = editor.state.doc.resolve(afterTable + 1);
          editor.view.dispatch(
            editor.state.tr.setSelection(TextSelection.near(newResolved))
          );
          break;
        }
      }
    }

    // Helper: explicitly replace the current empty paragraph with a block node.
    // This prevents ProseMirror from accidentally touching adjacent atom nodes (e.g., TOC).
    const replaceCurrentParagraph = (insertFn: () => void) => {
      try {
        const { $from } = editor.state.selection;
        if ($from.parent.type.name === 'paragraph' && $from.parent.content.size === 0) {
          const paraPos = $from.before();
          const nodeSel = NodeSelection.create(editor.state.doc, paraPos);
          editor.view.dispatch(editor.state.tr.setSelection(nodeSel));
        }
      } catch { /* ignore */ }
      insertFn();
    };

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
      case 'divider':
        replaceCurrentParagraph(() => editor.chain().focus().setHorizontalRule().run());
        break;
      case 'table':
        replaceCurrentParagraph(() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        );
        break;
      case 'image': {
        editor.chain().focus().run();
        fileInputRef.current?.click();
        break;
      }
      case 'mathInline':
        editor.chain().focus().insertContent({ type: 'mathInline', attrs: { latex: '' } }).run();
        break;
      case 'mathBlock':
        replaceCurrentParagraph(() =>
          editor.chain().focus().insertContent({ type: 'mathBlock', attrs: { latex: '' } }).run()
        );
        break;
      case 'toc':
        replaceCurrentParagraph(() =>
          editor.chain().focus().insertContent({ type: 'tableOfContents' }).run()
        );
        break;
      case 'subpage': {
        // Save the cursor position BEFORE the async API call
        const insertPos = editor.state.selection.from;
        const created = await onInsertSubPage?.();
        if (created) {
          editor.chain().focus().insertContentAt(insertPos, {
            type: 'subPageLink',
            attrs: { pageId: created.id, title: created.title || 'Untitled' },
          }).run();
          const updatedHtml = editor.getHTML();
          onChange(updatedHtml);
          if (onSaveContent) await onSaveContent(updatedHtml);
          onNavigateToPage?.(created.id);
        }
        break;
      }
    }
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
        <div className="max-w-[960px] xl:max-w-[1100px] 2xl:max-w-[1250px] mx-auto px-8 sm:px-14 lg:px-16 py-8 pb-[100vh]">
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

      {blockMenu && editor && (
        <BlockMenu
          pos={blockMenu.pos}
          anchorRect={blockMenu.rect}
          blockType={blockMenu.blockType}
          editor={editor}
          onClose={() => setBlockMenu(null)}
        />
      )}
    </div>
  );
}
