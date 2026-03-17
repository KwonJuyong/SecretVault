'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code2, Minus, Table, Type, Image, FileText,
} from 'lucide-react';

export type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered' | 'todo' | 'quote' | 'code' | 'divider' | 'table' | 'image' | 'subpage';

export interface SlashCommand {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
  keywords: string[];
}

const commands: SlashCommand[] = [
  { type: 'h1', label: 'Heading 1', description: 'Big section heading', icon: <Heading1 size={20} />, keywords: ['h1', 'heading', 'title', 'big'] },
  { type: 'h2', label: 'Heading 2', description: 'Medium section heading', icon: <Heading2 size={20} />, keywords: ['h2', 'heading', 'subtitle'] },
  { type: 'h3', label: 'Heading 3', description: 'Small section heading', icon: <Heading3 size={20} />, keywords: ['h3', 'heading', 'small'] },
  { type: 'paragraph', label: 'Text', description: 'Plain text paragraph', icon: <Type size={20} />, keywords: ['text', 'paragraph', 'plain'] },
  { type: 'bullet', label: 'Bullet List', description: 'Unordered list item', icon: <List size={20} />, keywords: ['bullet', 'list', 'unordered', 'ul'] },
  { type: 'numbered', label: 'Numbered List', description: 'Ordered list item', icon: <ListOrdered size={20} />, keywords: ['numbered', 'list', 'ordered', 'ol', 'number'] },
  { type: 'todo', label: 'To-do', description: 'Task with checkbox', icon: <CheckSquare size={20} />, keywords: ['todo', 'task', 'checkbox', 'check'] },
  { type: 'quote', label: 'Quote', description: 'Blockquote', icon: <Quote size={20} />, keywords: ['quote', 'blockquote'] },
  { type: 'code', label: 'Code', description: 'Code block', icon: <Code2 size={20} />, keywords: ['code', 'snippet', 'programming'] },
  { type: 'divider', label: 'Divider', description: 'Horizontal line separator', icon: <Minus size={20} />, keywords: ['divider', 'separator', 'line', 'hr'] },
  { type: 'table', label: 'Table', description: 'Insert a table (3x3)', icon: <Table size={20} />, keywords: ['table', 'grid', 'spreadsheet'] },
  { type: 'image', label: 'Image', description: 'Upload an image', icon: <Image size={20} />, keywords: ['image', 'photo', 'picture', 'img'] },
  { type: 'subpage', label: 'Sub-page', description: 'Create a nested page', icon: <FileText size={20} />, keywords: ['subpage', 'page', 'nested', 'child', 'sub'] },
];

interface SlashMenuProps {
  filter: string;
  position: { top: number; left: number };
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export default function SlashMenu({ filter, position, onSelect, onClose }: SlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = commands.filter(cmd => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return cmd.label.toLowerCase().includes(q)
      || cmd.description.toLowerCase().includes(q)
      || cmd.keywords.some(k => k.includes(q));
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].type);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [filtered, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    const el = menuRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Adjust position to not overflow viewport
  const adjustedPosition = { ...position };
  if (typeof window !== 'undefined') {
    const menuHeight = 400;
    const menuWidth = 288;
    if (position.top + menuHeight > window.innerHeight) {
      adjustedPosition.top = Math.max(8, position.top - menuHeight - 8);
    }
    if (position.left + menuWidth > window.innerWidth) {
      adjustedPosition.left = window.innerWidth - menuWidth - 8;
    }
  }

  if (filtered.length === 0) {
    return (
      <div
        className="fixed z-50 w-72 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-3"
        style={{ top: adjustedPosition.top, left: adjustedPosition.left }}
      >
        <p className="text-sm text-neutral-400 text-center py-2">No matching commands</p>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={containerRef}
        className="fixed z-50 w-72 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
        style={{ top: adjustedPosition.top, left: adjustedPosition.left }}
      >
        <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Blocks</p>
        </div>
        <div ref={menuRef} className="max-h-72 overflow-y-auto p-1">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.type}
              onClick={() => onSelect(cmd.type)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                i === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                i === selectedIndex
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
              }`}>
                {cmd.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{cmd.label}</p>
                <p className="text-[11px] text-neutral-400 truncate">{cmd.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
