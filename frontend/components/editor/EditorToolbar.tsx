'use client';

import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Code, Link2,
  Table, Minus, Image, Sigma, Braces,
} from 'lucide-react';

interface ToolbarAction {
  icon: React.ReactNode;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean;
}

const actions: ToolbarAction[] = [
  { icon: <Bold size={15} />, label: 'Bold', prefix: '**', suffix: '**' },
  { icon: <Italic size={15} />, label: 'Italic', prefix: '_', suffix: '_' },
  { icon: <Strikethrough size={15} />, label: 'Strikethrough', prefix: '~~', suffix: '~~' },
  { icon: <Code size={15} />, label: 'Inline Code', prefix: '`', suffix: '`' },
  { icon: <Heading1 size={15} />, label: 'Heading 1', prefix: '# ', suffix: '', block: true },
  { icon: <Heading2 size={15} />, label: 'Heading 2', prefix: '## ', suffix: '', block: true },
  { icon: <Heading3 size={15} />, label: 'Heading 3', prefix: '### ', suffix: '', block: true },
  { icon: <List size={15} />, label: 'Bullet List', prefix: '- ', suffix: '', block: true },
  { icon: <ListOrdered size={15} />, label: 'Numbered List', prefix: '1. ', suffix: '', block: true },
  { icon: <CheckSquare size={15} />, label: 'Task List', prefix: '- [ ] ', suffix: '', block: true },
  { icon: <Quote size={15} />, label: 'Blockquote', prefix: '> ', suffix: '', block: true },
  { icon: <Link2 size={15} />, label: 'Link', prefix: '[', suffix: '](url)' },
  { icon: <Image size={15} />, label: 'Image', prefix: '![alt](', suffix: ')' },
  { icon: <Minus size={15} />, label: 'Divider', prefix: '\n---\n', suffix: '', block: true },
  { icon: <Table size={15} />, label: 'Table', prefix: '\n| Header | Header |\n|--------|--------|\n| Cell   | Cell   |\n', suffix: '', block: true },
  { icon: <Braces size={15} />, label: 'Code Block', prefix: '\n```\n', suffix: '\n```\n', block: true },
  { icon: <Sigma size={15} />, label: 'LaTeX (inline)', prefix: '$', suffix: '$' },
];

interface EditorToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  onChangeContent: (content: string) => void;
}

export default function EditorToolbar({ textareaRef, content, onChangeContent }: EditorToolbarProps) {
  const applyAction = (action: ToolbarAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);

    let newText: string;
    let newCursorPos: number;

    if (action.block && !selected) {
      // For block elements, insert on new line
      const beforeCursor = content.substring(0, start);
      const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
      const prefix = (needsNewline ? '\n' : '') + action.prefix;
      newText = content.substring(0, start) + prefix + action.suffix + content.substring(end);
      newCursorPos = start + prefix.length;
    } else {
      newText = content.substring(0, start) + action.prefix + (selected || 'text') + action.suffix + content.substring(end);
      newCursorPos = start + action.prefix.length + (selected || 'text').length;
    }

    onChangeContent(newText);
    // Restore focus and selection
    requestAnimationFrame(() => {
      textarea.focus();
      if (!selected) {
        if (action.prefix === '[') {
          // Select 'text' placeholder for link
          textarea.setSelectionRange(start + action.prefix.length, start + action.prefix.length + 4);
        } else {
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      } else {
        textarea.setSelectionRange(start + action.prefix.length, start + action.prefix.length + selected.length);
      }
    });
  };

  const insertLatexBlock = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const beforeCursor = content.substring(0, start);
    const needsNewline = beforeCursor.length > 0 && !beforeCursor.endsWith('\n');
    const prefix = (needsNewline ? '\n' : '') + '$$\n';
    const suffix = '\n$$\n';
    const inner = selected || 'E = mc^2';
    const newText = content.substring(0, start) + prefix + inner + suffix + content.substring(end);
    onChangeContent(newText);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + inner.length);
    });
  };

  // Group separators at indices
  const groups = [
    actions.slice(0, 4),   // text formatting
    actions.slice(4, 7),   // headings
    actions.slice(7, 11),  // lists & quote
    actions.slice(11, 17), // links, media, blocks
  ];

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-neutral-100 dark:border-neutral-800/50 overflow-x-auto flex-shrink-0">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />}
          {group.map((action, ai) => (
            <button
              key={ai}
              onClick={() => applyAction(action)}
              title={action.label}
              className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition"
            >
              {action.icon}
            </button>
          ))}
        </div>
      ))}
      {/* LaTeX block button */}
      <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />
      <button
        onClick={insertLatexBlock}
        title="LaTeX Block ($$)"
        className="px-2 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition text-[11px] font-mono font-bold"
      >
        $$
      </button>
    </div>
  );
}
