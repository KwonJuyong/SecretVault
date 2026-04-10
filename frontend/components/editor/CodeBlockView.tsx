'use client';

import { Editor } from '@tiptap/react';

const LANGUAGES = [
  { value: '', label: 'Auto' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'graphql', label: 'GraphQL' },
];

interface CodeBlockToolbarProps {
  editor: Editor;
}

export default function CodeBlockToolbar({ editor }: CodeBlockToolbarProps) {
  const currentLang = editor.getAttributes('codeBlock').language || '';

  return (
    <div className="flex items-center gap-2 px-5 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-2)] text-[11.5px]">
      <span className="text-[var(--fg-tertiary)] mr-1 font-medium">Code</span>
      <select
        value={currentLang}
        onChange={e => {
          editor.chain().focus().updateAttributes('codeBlock', { language: e.target.value }).run();
        }}
        className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-md px-2 py-0.5 text-[11.5px] text-[var(--fg-secondary)] outline-none cursor-pointer hover:border-[var(--border-strong)] focus:border-[var(--accent)] transition-colors"
      >
        {LANGUAGES.map(lang => (
          <option key={lang.value} value={lang.value}>{lang.label}</option>
        ))}
      </select>
    </div>
  );
}

export { LANGUAGES };
