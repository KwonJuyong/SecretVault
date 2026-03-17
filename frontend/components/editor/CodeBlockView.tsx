'use client';

import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { useCallback } from 'react';

const LANGUAGES = [
  { value: '', label: 'Plain text' },
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
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'latex', label: 'LaTeX' },
  { value: 'r', label: 'R' },
  { value: 'scala', label: 'Scala' },
  { value: 'lua', label: 'Lua' },
  { value: 'dart', label: 'Dart' },
  { value: 'graphql', label: 'GraphQL' },
];

export default function CodeBlockView({ node, updateAttributes, extension }: any) {
  const language = node.attrs.language || '';

  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateAttributes({ language: e.target.value });
  }, [updateAttributes]);

  return (
    <NodeViewWrapper className="code-block-wrapper">
      <div className="code-block-header">
        <select
          contentEditable={false}
          value={language}
          onChange={handleChange}
          className="code-block-lang-select"
        >
          {LANGUAGES.map(lang => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  );
}
