'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code2, Minus, Table, Type, Image, FileText, Sigma, Pi, AlignLeft,
} from 'lucide-react';

export type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'numbered' | 'todo' | 'quote' | 'code' | 'divider' | 'table' | 'image' | 'subpage' | 'mathInline' | 'mathBlock' | 'toc';

export interface SlashCommand {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
  keywords: string[];
}

interface SlashMenuProps {
  filter: string;
  position: { top: number; lineTop: number; left: number };
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export default function SlashMenu({ filter, position, onSelect, onClose }: SlashMenuProps) {
  const { t } = useLanguage();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const commands: SlashCommand[] = [
    { type: 'h1', label: t.h1Label, description: t.h1Desc, icon: <Heading1 size={20} />, keywords: ['h1', 'heading', 'title', 'big', '제목'] },
    { type: 'h2', label: t.h2Label, description: t.h2Desc, icon: <Heading2 size={20} />, keywords: ['h2', 'heading', 'subtitle', '제목'] },
    { type: 'h3', label: t.h3Label, description: t.h3Desc, icon: <Heading3 size={20} />, keywords: ['h3', 'heading', 'small', '제목'] },
    { type: 'paragraph', label: t.textLabel, description: t.textDesc, icon: <Type size={20} />, keywords: ['text', 'paragraph', 'plain', '텍스트'] },
    { type: 'bullet', label: t.bulletLabel, description: t.bulletDesc, icon: <List size={20} />, keywords: ['bullet', 'list', 'unordered', 'ul', '목록'] },
    { type: 'numbered', label: t.numberedLabel, description: t.numberedDesc, icon: <ListOrdered size={20} />, keywords: ['numbered', 'list', 'ordered', 'ol', 'number', '번호'] },
    { type: 'todo', label: t.todoLabel, description: t.todoDesc, icon: <CheckSquare size={20} />, keywords: ['todo', 'task', 'checkbox', 'check', '할일'] },
    { type: 'quote', label: t.quoteLabel, description: t.quoteDesc, icon: <Quote size={20} />, keywords: ['quote', 'blockquote', '인용'] },
    { type: 'code', label: t.codeLabel, description: t.codeDesc, icon: <Code2 size={20} />, keywords: ['code', 'snippet', 'programming', '코드'] },
    { type: 'divider', label: t.dividerLabel, description: t.dividerDesc, icon: <Minus size={20} />, keywords: ['divider', 'separator', 'line', 'hr', '구분선'] },
    { type: 'table', label: t.tableLabel, description: t.tableDesc, icon: <Table size={20} />, keywords: ['table', 'grid', 'spreadsheet', '표'] },
    { type: 'image', label: t.imageLabel, description: t.imageDesc, icon: <Image size={20} />, keywords: ['image', 'photo', 'picture', 'img', '이미지'] },
    { type: 'mathInline', label: t.mathInlineLabel, description: t.mathInlineDesc, icon: <Sigma size={20} />, keywords: ['math', 'latex', 'formula', 'equation', 'inline', 'katex', '수식'] },
    { type: 'mathBlock', label: t.mathBlockLabel, description: t.mathBlockDesc, icon: <Pi size={20} />, keywords: ['math', 'latex', 'formula', 'equation', 'block', 'display', 'katex', '수식'] },
    { type: 'subpage', label: t.subpageLabel, description: t.subpageDesc, icon: <FileText size={20} />, keywords: ['subpage', 'page', 'nested', 'child', 'sub', '하위페이지'] },
    { type: 'toc', label: t.tocLabel, description: t.tocDesc, icon: <AlignLeft size={20} />, keywords: ['toc', 'contents', 'table of contents', 'outline', '목차', 'content'] },
  ];

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
      if (e.isComposing) return;
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

  // Decide whether to show above or below the cursor line
  const menuHeight = 400;
  const menuWidth = 288;
  const margin = 8;
  let adjustedTop = position.top;
  let adjustedLeft = position.left;

  if (typeof window !== 'undefined') {
    const spaceBelow = window.innerHeight - position.top - margin;
    const spaceAbove = position.lineTop - margin;

    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      // Not enough room below and more space above — show above
      adjustedTop = Math.max(margin, position.lineTop - menuHeight - 6);
    } else {
      // Show below; clamp to viewport bottom
      adjustedTop = position.top;
      if (adjustedTop + menuHeight > window.innerHeight) {
        adjustedTop = Math.max(margin, window.innerHeight - menuHeight - margin);
      }
    }

    if (adjustedLeft + menuWidth > window.innerWidth) {
      adjustedLeft = window.innerWidth - menuWidth - margin;
    }
    if (adjustedLeft < margin) adjustedLeft = margin;
  }

  const adjustedPosition = { top: adjustedTop, left: adjustedLeft };

  if (filtered.length === 0) {
    return (
      <div
        className="fixed z-50 w-72 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-3"
        style={{ top: adjustedPosition.top, left: adjustedPosition.left }}
      >
        <p className="text-sm text-neutral-400 text-center py-2">{t.noMatchingCommands}</p>
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
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{t.blocks}</p>
        </div>
        <div ref={menuRef} className="max-h-72 overflow-y-auto p-1">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.type}
              onClick={() => onSelect(cmd.type)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                i === selectedIndex
                  ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-500 dark:text-violet-300'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                i === selectedIndex
                  ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-500 dark:text-violet-400'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
              }`}>
                {cmd.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{cmd.label}</p>
                <p className="text-xs text-neutral-400 truncate">{cmd.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
