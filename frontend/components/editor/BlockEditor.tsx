'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.min.css';
import { GripVertical, Plus, Copy, Check, Trash2 } from 'lucide-react';
import SlashMenu, { type BlockType } from './SlashMenu';

// ─── Block Model ───────────────────────────────────────────────
interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  language?: string;
}

let _blockId = 0;
function genId() { return `b-${Date.now()}-${_blockId++}`; }

// ─── Markdown ↔ Blocks Parser ──────────────────────────────────
function parseMarkdown(md: string): Block[] {
  if (!md) return [{ id: genId(), type: 'paragraph', content: '' }];
  const lines = md.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ id: genId(), type: 'code', content: codeLines.join('\n'), language: lang });
      i++;
      continue;
    }

    // LaTeX block
    if (line.startsWith('$$')) {
      const latexLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('$$')) {
        latexLines.push(lines[i]);
        i++;
      }
      blocks.push({ id: genId(), type: 'latex', content: latexLines.join('\n') });
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push({ id: genId(), type: 'h3', content: line.slice(4) });
    } else if (line.startsWith('## ')) {
      blocks.push({ id: genId(), type: 'h2', content: line.slice(3) });
    } else if (line.startsWith('# ')) {
      blocks.push({ id: genId(), type: 'h1', content: line.slice(2) });
    } else if (/^- \[x\] /i.test(line)) {
      blocks.push({ id: genId(), type: 'todo', content: line.slice(6), checked: true });
    } else if (line.startsWith('- [ ] ')) {
      blocks.push({ id: genId(), type: 'todo', content: line.slice(6), checked: false });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({ id: genId(), type: 'bullet', content: line.slice(2) });
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^\d+\.\s(.*)/);
      blocks.push({ id: genId(), type: 'numbered', content: match ? match[1] : '' });
    } else if (line.startsWith('> ')) {
      blocks.push({ id: genId(), type: 'quote', content: line.slice(2) });
    } else if (/^---$|^\*\*\*$|^___$/.test(line.trim())) {
      blocks.push({ id: genId(), type: 'divider', content: '' });
    } else if (line.startsWith('| ')) {
      // Collect all table lines
      const tableLines: string[] = [line];
      while (i + 1 < lines.length && (lines[i + 1].startsWith('|') || lines[i + 1].startsWith('|-'))) {
        i++;
        tableLines.push(lines[i]);
      }
      blocks.push({ id: genId(), type: 'table', content: tableLines.join('\n') });
    } else if (line.startsWith('![')) {
      blocks.push({ id: genId(), type: 'image', content: line });
    } else {
      blocks.push({ id: genId(), type: 'paragraph', content: line });
    }
    i++;
  }

  if (blocks.length === 0) {
    blocks.push({ id: genId(), type: 'paragraph', content: '' });
  }
  return blocks;
}

function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map(block => {
    switch (block.type) {
      case 'h1': return `# ${block.content}`;
      case 'h2': return `## ${block.content}`;
      case 'h3': return `### ${block.content}`;
      case 'bullet': return `- ${block.content}`;
      case 'numbered': return `1. ${block.content}`;
      case 'todo': return `- [${block.checked ? 'x' : ' '}] ${block.content}`;
      case 'quote': return `> ${block.content}`;
      case 'code': return `\`\`\`${block.language || ''}\n${block.content}\n\`\`\``;
      case 'latex': return `$$\n${block.content}\n$$`;
      case 'divider': return '---';
      case 'table': return block.content;
      case 'image': return block.content;
      default: return block.content;
    }
  }).join('\n');
}

// ─── Block Editor Component ────────────────────────────────────
interface BlockEditorProps {
  content: string;
  onChangeContent: (content: string) => void;
}

export default function BlockEditor({ content, onChangeContent }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => parseMarkdown(content));
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; filter: string; position: { top: number; left: number } } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const blockRefs = useRef<Map<string, HTMLTextAreaElement | HTMLDivElement>>(new Map());
  const suppressSync = useRef(false);

  // Sync content from parent (page load)
  useEffect(() => {
    if (suppressSync.current) {
      suppressSync.current = false;
      return;
    }
    setBlocks(parseMarkdown(content));
  }, [content]);

  // Sync blocks to parent
  const syncToParent = useCallback((newBlocks: Block[]) => {
    suppressSync.current = true;
    onChangeContent(blocksToMarkdown(newBlocks));
  }, [onChangeContent]);

  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    setBlocks(prev => {
      const next = prev.map(b => b.id === id ? { ...b, ...updates } : b);
      syncToParent(next);
      return next;
    });
  }, [syncToParent]);

  const focusBlock = useCallback((id: string, cursorEnd = true) => {
    setFocusedId(id);
    requestAnimationFrame(() => {
      const el = blockRefs.current.get(id);
      if (el && 'focus' in el) {
        (el as HTMLTextAreaElement).focus();
        if (cursorEnd && 'setSelectionRange' in el) {
          const len = (el as HTMLTextAreaElement).value?.length || 0;
          (el as HTMLTextAreaElement).setSelectionRange(len, len);
        }
      }
    });
  }, []);

  const insertBlockAfter = useCallback((afterId: string, type: BlockType = 'paragraph', content = '') => {
    const newBlock: Block = { id: genId(), type, content };
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === afterId);
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      syncToParent(next);
      return next;
    });
    requestAnimationFrame(() => focusBlock(newBlock.id, false));
    return newBlock.id;
  }, [syncToParent, focusBlock]);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(prev => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex(b => b.id === id);
      const next = prev.filter(b => b.id !== id);
      syncToParent(next);
      const focusIdx = Math.max(0, idx - 1);
      requestAnimationFrame(() => focusBlock(next[focusIdx].id));
      return next;
    });
  }, [syncToParent, focusBlock]);

  // ─── Keyboard handling ─────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block) => {
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;
    const isMultiline = block.type === 'code' || block.type === 'latex' || block.type === 'table';

    // Slash menu is open - let it handle keys
    if (slashMenu) return;

    // Enter key
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isMultiline) return; // Allow normal newlines in code/latex/table

      e.preventDefault();

      // Split content at cursor
      const before = value.slice(0, selectionStart);
      const after = value.slice(selectionEnd);

      // If block is a list type and content is empty, convert to paragraph
      if (!before && !after && ['bullet', 'numbered', 'todo', 'quote'].includes(block.type)) {
        updateBlock(block.id, { type: 'paragraph' });
        return;
      }

      updateBlock(block.id, { content: before });
      // New block inherits list type
      const newType: BlockType = ['bullet', 'numbered', 'todo'].includes(block.type) ? block.type : 'paragraph';
      const newId = insertBlockAfter(block.id, newType, after);
      if (block.type === 'todo') {
        setBlocks(prev => prev.map(b => b.id === newId ? { ...b, checked: false } : b));
      }
    }

    // Backspace at start
    if (e.key === 'Backspace' && selectionStart === 0 && selectionEnd === 0) {
      // Convert typed block back to paragraph
      if (block.type !== 'paragraph') {
        e.preventDefault();
        updateBlock(block.id, { type: 'paragraph' });
        return;
      }

      // Merge with previous block
      const idx = blocks.findIndex(b => b.id === block.id);
      if (idx > 0) {
        e.preventDefault();
        const prevBlock = blocks[idx - 1];
        if (prevBlock.type === 'divider') {
          deleteBlock(prevBlock.id);
          return;
        }
        const mergedContent = prevBlock.content + value;
        const cursorPos = prevBlock.content.length;
        updateBlock(prevBlock.id, { content: mergedContent });
        deleteBlock(block.id);
        requestAnimationFrame(() => {
          const el = blockRefs.current.get(prevBlock.id) as HTMLTextAreaElement;
          if (el) {
            el.focus();
            el.setSelectionRange(cursorPos, cursorPos);
          }
        });
      }
    }

    // Arrow up at start of block - focus previous
    if (e.key === 'ArrowUp' && selectionStart === 0 && !isMultiline) {
      const idx = blocks.findIndex(b => b.id === block.id);
      if (idx > 0) {
        e.preventDefault();
        focusBlock(blocks[idx - 1].id);
      }
    }

    // Arrow down at end of block - focus next
    if (e.key === 'ArrowDown' && selectionEnd === value.length && !isMultiline) {
      const idx = blocks.findIndex(b => b.id === block.id);
      if (idx < blocks.length - 1) {
        e.preventDefault();
        focusBlock(blocks[idx + 1].id, false);
        requestAnimationFrame(() => {
          const el = blockRefs.current.get(blocks[idx + 1].id) as HTMLTextAreaElement;
          if (el) el.setSelectionRange(0, 0);
        });
      }
    }

    // Tab for indentation in code/latex blocks
    if (e.key === 'Tab' && isMultiline) {
      e.preventDefault();
      const newContent = value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd);
      updateBlock(block.id, { content: newContent });
      requestAnimationFrame(() => {
        textarea.setSelectionRange(selectionStart + 2, selectionStart + 2);
      });
    }

    // Escape to exit code/latex blocks
    if (e.key === 'Escape' && isMultiline) {
      e.preventDefault();
      insertBlockAfter(block.id);
    }
  }, [blocks, slashMenu, updateBlock, insertBlockAfter, deleteBlock, focusBlock]);

  // ─── Input handling (markdown shortcuts + slash menu) ──────
  const handleInput = useCallback((blockId: string, newValue: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    // Only detect shortcuts for paragraph blocks
    if (block.type === 'paragraph') {
      // Heading shortcuts
      if (newValue === '# ') { updateBlock(blockId, { type: 'h1', content: '' }); return; }
      if (newValue === '## ') { updateBlock(blockId, { type: 'h2', content: '' }); return; }
      if (newValue === '### ') { updateBlock(blockId, { type: 'h3', content: '' }); return; }
      // List shortcuts
      if (newValue === '- ') { updateBlock(blockId, { type: 'bullet', content: '' }); return; }
      if (newValue === '* ') { updateBlock(blockId, { type: 'bullet', content: '' }); return; }
      if (newValue === '1. ') { updateBlock(blockId, { type: 'numbered', content: '' }); return; }
      if (newValue === '- [ ] ' || newValue === '- [] ') { updateBlock(blockId, { type: 'todo', content: '', checked: false }); return; }
      // Quote
      if (newValue === '> ') { updateBlock(blockId, { type: 'quote', content: '' }); return; }
      // Divider
      if (newValue === '---' || newValue === '***') {
        updateBlock(blockId, { type: 'divider', content: '' });
        insertBlockAfter(blockId);
        return;
      }
      // Code block
      if (newValue === '```') {
        updateBlock(blockId, { type: 'code', content: '', language: '' });
        return;
      }
      if (newValue.startsWith('```') && newValue.length > 3) {
        updateBlock(blockId, { type: 'code', content: '', language: newValue.slice(3) });
        return;
      }
      // LaTeX block
      if (newValue === '$$') {
        updateBlock(blockId, { type: 'latex', content: '' });
        return;
      }
    }

    // Slash command detection
    if (newValue === '/') {
      const el = blockRefs.current.get(blockId);
      if (el) {
        const rect = el.getBoundingClientRect();
        setSlashMenu({
          blockId,
          filter: '',
          position: { top: rect.bottom + 4, left: rect.left },
        });
      }
      updateBlock(blockId, { content: newValue });
      return;
    }

    if (slashMenu && slashMenu.blockId === blockId) {
      if (newValue.startsWith('/')) {
        setSlashMenu(prev => prev ? { ...prev, filter: newValue.slice(1) } : null);
        updateBlock(blockId, { content: newValue });
        return;
      } else {
        setSlashMenu(null);
      }
    }

    updateBlock(blockId, { content: newValue });
  }, [blocks, slashMenu, updateBlock, insertBlockAfter]);

  // ─── Slash menu selection ──────────────────────────────────
  const handleSlashSelect = useCallback((type: BlockType) => {
    if (!slashMenu) return;
    const { blockId } = slashMenu;

    if (type === 'divider') {
      updateBlock(blockId, { type: 'divider', content: '' });
      insertBlockAfter(blockId);
    } else if (type === 'code') {
      updateBlock(blockId, { type: 'code', content: '', language: '' });
    } else if (type === 'latex') {
      updateBlock(blockId, { type: 'latex', content: '' });
    } else if (type === 'table') {
      updateBlock(blockId, { type: 'table', content: '| Column 1 | Column 2 |\n|----------|----------|\n| Cell     | Cell     |' });
    } else if (type === 'image') {
      updateBlock(blockId, { type: 'image', content: '![Image description](url)' });
    } else if (type === 'todo') {
      updateBlock(blockId, { type: 'todo', content: '', checked: false });
    } else {
      updateBlock(blockId, { type, content: '' });
    }

    setSlashMenu(null);
    requestAnimationFrame(() => focusBlock(blockId));
  }, [slashMenu, updateBlock, insertBlockAfter, focusBlock]);

  // ─── Auto-resize textarea ─────────────────────────────────
  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  // ─── Render a single block ────────────────────────────────
  const renderBlock = (block: Block, index: number) => {
    const isFocused = focusedId === block.id;
    const isHovered = hoveredId === block.id;

    // Block wrapper styles per type
    const typeStyles: Record<string, string> = {
      h1: 'text-3xl font-bold',
      h2: 'text-2xl font-semibold',
      h3: 'text-xl font-semibold',
      paragraph: 'text-base',
      bullet: 'text-base',
      numbered: 'text-base',
      todo: 'text-base',
      quote: 'text-base italic border-l-4 border-blue-400 pl-4 text-neutral-500 dark:text-neutral-400',
      code: 'font-mono text-sm',
      latex: 'text-base',
      divider: '',
      table: 'text-sm',
      image: 'text-base',
    };

    // Divider block
    if (block.type === 'divider') {
      return (
        <div
          key={block.id}
          className="group relative py-2"
          onMouseEnter={() => setHoveredId(block.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div className="flex items-center gap-1 absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => deleteBlock(block.id)}
              className="p-0.5 rounded text-neutral-300 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
          <hr className="border-neutral-200 dark:border-neutral-800" />
        </div>
      );
    }

    // Code block (multi-line)
    if (block.type === 'code') {
      return (
        <div
          key={block.id}
          className="group relative my-2"
          onMouseEnter={() => setHoveredId(block.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <BlockHandle onAdd={() => insertBlockAfter(block.id)} onDelete={() => deleteBlock(block.id)} visible={isHovered} />
          {isFocused ? (
            <div className="bg-neutral-900 dark:bg-neutral-950 rounded-xl border border-neutral-700 overflow-hidden">
              <div className="flex items-center px-4 py-2 border-b border-neutral-700/50">
                <input
                  type="text"
                  value={block.language || ''}
                  onChange={e => updateBlock(block.id, { language: e.target.value })}
                  placeholder="language (e.g. python, js)"
                  className="bg-transparent text-xs text-neutral-400 outline-none w-32 placeholder-neutral-600"
                />
              </div>
              <textarea
                ref={el => {
                  if (el) { blockRefs.current.set(block.id, el); autoResize(el); }
                }}
                value={block.content}
                onChange={e => {
                  updateBlock(block.id, { content: e.target.value });
                  autoResize(e.target);
                }}
                onKeyDown={e => handleKeyDown(e, block)}
                onFocus={() => setFocusedId(block.id)}
                className="w-full bg-transparent text-neutral-200 font-mono text-sm p-4 outline-none resize-none min-h-[3rem]"
                placeholder="Write code..."
                autoFocus
              />
            </div>
          ) : (
            <div
              onClick={() => focusBlock(block.id)}
              className="bg-neutral-900 dark:bg-neutral-950 rounded-xl p-4 border border-neutral-800 cursor-text relative group/code"
            >
              <CopyBtn text={block.content} />
              {block.language && (
                <span className="absolute top-2 left-4 text-[10px] text-neutral-500 uppercase tracking-wider">{block.language}</span>
              )}
              <pre className={`text-sm font-mono text-neutral-200 overflow-x-auto ${block.language ? 'pt-4' : ''}`}>
                <code>{block.content || ' '}</code>
              </pre>
            </div>
          )}
        </div>
      );
    }

    // LaTeX block
    if (block.type === 'latex') {
      return (
        <div
          key={block.id}
          className="group relative my-2"
          onMouseEnter={() => setHoveredId(block.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <BlockHandle onAdd={() => insertBlockAfter(block.id)} onDelete={() => deleteBlock(block.id)} visible={isHovered} />
          {isFocused ? (
            <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="px-4 py-1.5 border-b border-neutral-200 dark:border-neutral-800">
                <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider">LaTeX</span>
              </div>
              <textarea
                ref={el => {
                  if (el) { blockRefs.current.set(block.id, el); autoResize(el); }
                }}
                value={block.content}
                onChange={e => {
                  updateBlock(block.id, { content: e.target.value });
                  autoResize(e.target);
                }}
                onKeyDown={e => handleKeyDown(e, block)}
                onFocus={() => setFocusedId(block.id)}
                className="w-full bg-transparent text-neutral-800 dark:text-neutral-200 font-mono text-sm p-4 outline-none resize-none min-h-[3rem]"
                placeholder="E = mc^2"
                autoFocus
              />
            </div>
          ) : (
            <div
              onClick={() => focusBlock(block.id)}
              className="bg-neutral-50 dark:bg-neutral-900/50 rounded-xl p-4 border border-neutral-200 dark:border-neutral-800 cursor-text text-center"
            >
              {block.content ? (
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {`$$\n${block.content}\n$$`}
                </ReactMarkdown>
              ) : (
                <span className="text-neutral-400 italic text-sm">Click to write LaTeX</span>
              )}
            </div>
          )}
        </div>
      );
    }

    // Table block
    if (block.type === 'table') {
      return (
        <div
          key={block.id}
          className="group relative my-2"
          onMouseEnter={() => setHoveredId(block.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <BlockHandle onAdd={() => insertBlockAfter(block.id)} onDelete={() => deleteBlock(block.id)} visible={isHovered} />
          {isFocused ? (
            <textarea
              ref={el => {
                if (el) { blockRefs.current.set(block.id, el); autoResize(el); }
              }}
              value={block.content}
              onChange={e => {
                updateBlock(block.id, { content: e.target.value });
                autoResize(e.target);
              }}
              onKeyDown={e => handleKeyDown(e, block)}
              onFocus={() => setFocusedId(block.id)}
              onBlur={() => setFocusedId(null)}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg font-mono text-sm p-3 outline-none resize-none"
              autoFocus
            />
          ) : (
            <div onClick={() => focusBlock(block.id)} className="cursor-text">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                table: ({ children, ...props }) => (
                  <table className="min-w-full border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden" {...props}>{children}</table>
                ),
                thead: ({ children, ...props }) => <thead className="bg-neutral-50 dark:bg-neutral-800/50" {...props}>{children}</thead>,
                th: ({ children, ...props }) => <th className="px-4 py-2 font-semibold text-left text-sm border-b border-neutral-200 dark:border-neutral-700" {...props}>{children}</th>,
                td: ({ children, ...props }) => <td className="px-4 py-2 text-sm border-t border-neutral-100 dark:border-neutral-800" {...props}>{children}</td>,
              }}>
                {block.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      );
    }

    // Image block
    if (block.type === 'image') {
      return (
        <div
          key={block.id}
          className="group relative my-2"
          onMouseEnter={() => setHoveredId(block.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <BlockHandle onAdd={() => insertBlockAfter(block.id)} onDelete={() => deleteBlock(block.id)} visible={isHovered} />
          {isFocused ? (
            <input
              ref={el => { if (el) blockRefs.current.set(block.id, el as unknown as HTMLTextAreaElement); }}
              type="text"
              value={block.content}
              onChange={e => updateBlock(block.id, { content: e.target.value })}
              onFocus={() => setFocusedId(block.id)}
              onBlur={() => setFocusedId(null)}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm p-3 outline-none font-mono"
              placeholder="![description](image-url)"
              autoFocus
            />
          ) : (
            <div onClick={() => focusBlock(block.id)} className="cursor-text">
              <ReactMarkdown>{block.content || '![]()'}</ReactMarkdown>
            </div>
          )}
        </div>
      );
    }

    // ─── Standard inline blocks (paragraph, headings, lists, quote) ───
    const renderInlinePreview = (text: string) => {
      if (!text) return null;
      return (
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex]}
          components={{
            p: ({ children }) => <>{children}</>,
            code: ({ children, ...props }) => (
              <code className="bg-neutral-100 dark:bg-neutral-800 text-rose-600 dark:text-rose-400 px-1 py-0.5 rounded text-[0.9em] font-mono" {...props}>{children}</code>
            ),
            a: ({ children, ...props }) => (
              <a className="text-blue-600 dark:text-blue-400 underline" {...props}>{children}</a>
            ),
            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            del: ({ children }) => <del className="line-through text-neutral-400">{children}</del>,
          }}
        >
          {text}
        </ReactMarkdown>
      );
    };

    // List bullet/number/checkbox rendering
    const renderPrefix = () => {
      if (block.type === 'bullet') {
        return <span className="w-6 flex-shrink-0 text-neutral-400 text-center select-none mt-[2px]">&bull;</span>;
      }
      if (block.type === 'numbered') {
        const idx = blocks.slice(0, index).filter(b => b.type === 'numbered').length + 1;
        return <span className="w-6 flex-shrink-0 text-neutral-400 text-right pr-1 select-none mt-[2px] text-sm">{idx}.</span>;
      }
      if (block.type === 'todo') {
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateBlock(block.id, { checked: !block.checked });
            }}
            className="w-6 flex-shrink-0 flex items-center justify-center mt-[2px]"
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
              block.checked
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-neutral-300 dark:border-neutral-600 hover:border-blue-400'
            }`}>
              {block.checked && <Check size={10} strokeWidth={3} />}
            </div>
          </button>
        );
      }
      return null;
    };

    return (
      <div
        key={block.id}
        className="group relative flex items-start"
        onMouseEnter={() => setHoveredId(block.id)}
        onMouseLeave={() => setHoveredId(null)}
      >
        <BlockHandle onAdd={() => insertBlockAfter(block.id)} onDelete={() => deleteBlock(block.id)} visible={isHovered} />

        {renderPrefix()}

        <div className={`flex-1 min-w-0 ${typeStyles[block.type] || ''}`}>
          {isFocused ? (
            <textarea
              ref={el => {
                if (el) { blockRefs.current.set(block.id, el); autoResize(el); }
              }}
              value={block.content}
              onChange={e => {
                handleInput(block.id, e.target.value);
                autoResize(e.target);
              }}
              onKeyDown={e => handleKeyDown(e, block)}
              onFocus={() => setFocusedId(block.id)}
              onBlur={() => {
                if (!slashMenu) setFocusedId(null);
              }}
              className={`w-full bg-transparent outline-none resize-none leading-relaxed text-neutral-800 dark:text-neutral-200 ${typeStyles[block.type]} ${
                block.checked ? 'line-through text-neutral-400' : ''
              }`}
              placeholder={getPlaceholder(block.type)}
              rows={1}
              autoFocus
            />
          ) : (
            <div
              onClick={() => focusBlock(block.id)}
              className={`cursor-text min-h-[1.5em] leading-relaxed ${
                block.checked ? 'line-through text-neutral-400' : 'text-neutral-800 dark:text-neutral-200'
              }`}
            >
              {block.content ? renderInlinePreview(block.content) : (
                <span className="text-neutral-300 dark:text-neutral-600">{getPlaceholder(block.type)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      <div className="space-y-0.5 pl-10">
        {blocks.map((block, i) => renderBlock(block, i))}
      </div>

      {/* Add block button at bottom */}
      <div className="pl-10 mt-4">
        <button
          onClick={() => {
            const lastBlock = blocks[blocks.length - 1];
            insertBlockAfter(lastBlock.id);
          }}
          className="flex items-center gap-2 text-sm text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 transition py-1"
        >
          <Plus size={16} />
          <span>Add a block</span>
        </button>
      </div>

      {/* Slash command menu */}
      {slashMenu && (
        <SlashMenu
          filter={slashMenu.filter}
          position={slashMenu.position}
          onSelect={handleSlashSelect}
          onClose={() => setSlashMenu(null)}
        />
      )}
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────────
function BlockHandle({ onAdd, onDelete, visible }: { onAdd: () => void; onDelete: () => void; visible: boolean }) {
  return (
    <div className={`absolute -left-10 top-0 flex items-center gap-0.5 pt-0.5 transition-opacity ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <button onClick={onAdd} className="p-0.5 rounded text-neutral-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition" title="Add block below">
        <Plus size={14} />
      </button>
      <button className="p-0.5 rounded text-neutral-300 hover:text-neutral-500 cursor-grab" title="Drag to reorder">
        <GripVertical size={14} />
      </button>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-400 hover:text-white transition opacity-0 group-hover/code:opacity-100"
      title="Copy code"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function getPlaceholder(type: BlockType): string {
  switch (type) {
    case 'h1': return 'Heading 1';
    case 'h2': return 'Heading 2';
    case 'h3': return 'Heading 3';
    case 'bullet': return 'List item';
    case 'numbered': return 'List item';
    case 'todo': return 'To-do';
    case 'quote': return 'Quote';
    default: return "Type '/' for commands...";
  }
}
