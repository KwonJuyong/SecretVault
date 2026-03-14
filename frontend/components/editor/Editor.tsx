'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.min.css';
import { Eye, Edit3, Columns, Copy, Check } from 'lucide-react';
import EditorToolbar from './EditorToolbar';

type ViewMode = 'edit' | 'preview' | 'split';

interface EditorProps {
  title: string;
  content: string;
  icon: string;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onChangeIcon: (icon: string) => void;
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-300 hover:text-white transition opacity-0 group-hover:opacity-100"
      title="Copy code"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export default function Editor({
  title, content, icon,
  onChangeTitle, onChangeContent, onChangeIcon,
}: EditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  // Handle Tab key in editor for indentation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      onChangeContent(newContent);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  }, [content, onChangeContent]);

  const commonEmojis = ['', '\u{1F4DD}', '\u{1F4CB}', '\u{1F4D6}', '\u{1F4DA}', '\u{1F4A1}', '\u{1F680}', '\u2B50', '\u{1F525}', '\u{1F4E6}', '\u{1F50D}', '\u{1F512}', '\u{1F3AF}', '\u2705', '\u26A0\uFE0F', '\u{1F4AC}', '\u{1F4BB}', '\u{1F9EA}', '\u{1F4CA}', '\u{1F4C1}'];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* View Mode Toggle */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-neutral-100 dark:border-neutral-800/50">
        <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('edit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              viewMode === 'edit'
                ? 'bg-white dark:bg-neutral-700 text-neutral-800 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Edit3 size={13} /> Write
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              viewMode === 'split'
                ? 'bg-white dark:bg-neutral-700 text-neutral-800 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Columns size={13} /> Split
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              viewMode === 'preview'
                ? 'bg-white dark:bg-neutral-700 text-neutral-800 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Eye size={13} /> Preview
          </button>
        </div>
      </div>

      {/* Markdown Toolbar - only show in edit/split */}
      {(viewMode === 'edit' || viewMode === 'split') && (
        <EditorToolbar
          textareaRef={textareaRef}
          content={content}
          onChangeContent={onChangeContent}
        />
      )}

      {/* Editor Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Edit Pane */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`flex flex-col overflow-y-auto ${viewMode === 'split' ? 'w-1/2 border-r border-neutral-100 dark:border-neutral-800' : 'w-full'}`}>
            <div className="max-w-3xl mx-auto w-full px-6 sm:px-12 py-10">
              {/* Icon + Title */}
              <div className="flex items-start gap-3 mb-4">
                <div className="relative">
                  <button
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className="text-4xl hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg p-1 transition"
                    title="Change icon"
                  >
                    {icon || '\u{1F4C4}'}
                  </button>
                  {showIconPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowIconPicker(false)} />
                      <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 p-2 grid grid-cols-5 gap-1 w-52">
                        {commonEmojis.map((emoji, i) => (
                          <button
                            key={i}
                            onClick={() => { onChangeIcon(emoji); setShowIconPicker(false); }}
                            className="text-xl p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
                          >
                            {emoji || '\u274C'}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={e => onChangeTitle(e.target.value)}
                  placeholder="Untitled"
                  className="flex-1 text-4xl font-extrabold text-neutral-900 dark:text-white bg-transparent border-none outline-none placeholder-neutral-300 dark:placeholder-neutral-600"
                />
              </div>

              {/* Content */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => onChangeContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Start writing... (Markdown, LaTeX, and code blocks supported)"
                className="w-full min-h-[60vh] text-base leading-relaxed text-neutral-700 dark:text-neutral-300 bg-transparent border-none outline-none resize-none placeholder-neutral-300 dark:placeholder-neutral-600 font-mono"
              />
            </div>
          </div>
        )}

        {/* Preview Pane */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`overflow-y-auto ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="max-w-3xl mx-auto w-full px-6 sm:px-12 py-10">
              <div className="flex items-center gap-3 mb-8 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <span className="text-4xl">{icon || '\u{1F4C4}'}</span>
                <h1 className="text-4xl font-extrabold text-neutral-900 dark:text-white">
                  {title || 'Untitled'}
                </h1>
              </div>
              <div className="prose-sv max-w-none text-neutral-800 dark:text-neutral-200 leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex, rehypeHighlight]}
                  components={{
                    h1: ({ children, ...props }) => <h1 className="text-2xl font-bold mt-8 mb-4 pb-2 border-b border-neutral-200 dark:border-neutral-700" {...props}>{children}</h1>,
                    h2: ({ children, ...props }) => <h2 className="text-xl font-bold mt-6 mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800" {...props}>{children}</h2>,
                    h3: ({ children, ...props }) => <h3 className="text-lg font-semibold mt-5 mb-2" {...props}>{children}</h3>,
                    h4: ({ children, ...props }) => <h4 className="text-base font-semibold mt-4 mb-2" {...props}>{children}</h4>,
                    p: ({ children, ...props }) => <p className="mb-4 leading-relaxed whitespace-pre-wrap" {...props}>{children}</p>,
                    code: ({ className, children, ...props }) => {
                      const isBlock = className?.includes('language-') || className?.includes('hljs');
                      if (isBlock) {
                        const codeText = String(children).replace(/\n$/, '');
                        return (
                          <div className="relative group my-4">
                            <CopyButton code={codeText} />
                            <pre className="bg-neutral-900 dark:bg-neutral-950 rounded-xl p-4 overflow-x-auto border border-neutral-800">
                              <code className={`text-sm font-mono ${className || ''}`} {...props}>{children}</code>
                            </pre>
                          </div>
                        );
                      }
                      return <code className="bg-neutral-100 dark:bg-neutral-800 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-md text-sm font-mono" {...props}>{children}</code>;
                    },
                    pre: ({ children }) => <>{children}</>,
                    blockquote: ({ children, ...props }) => (
                      <blockquote className="border-l-4 border-blue-500 pl-4 my-4 text-neutral-600 dark:text-neutral-400 italic bg-blue-50/30 dark:bg-blue-900/10 py-2 rounded-r-lg" {...props}>{children}</blockquote>
                    ),
                    ul: ({ children, ...props }) => <ul className="list-disc pl-6 mb-4 space-y-1" {...props}>{children}</ul>,
                    ol: ({ children, ...props }) => <ol className="list-decimal pl-6 mb-4 space-y-1" {...props}>{children}</ol>,
                    li: ({ children, className, ...props }) => {
                      // GFM task list support
                      const hasCheckbox = Array.isArray(children) && children.some(
                        (child: unknown) => typeof child === 'object' && child !== null && 'type' in child && (child as { type: string }).type === 'input'
                      );
                      return (
                        <li className={`${hasCheckbox ? 'list-none -ml-6 flex items-start gap-2' : ''} ${className || ''}`} {...props}>
                          {children}
                        </li>
                      );
                    },
                    input: ({ type, checked, ...props }) => {
                      if (type === 'checkbox') {
                        return (
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            className="mt-1 h-4 w-4 rounded border-neutral-300 text-blue-600 cursor-default"
                            {...props}
                          />
                        );
                      }
                      return <input type={type} {...props} />;
                    },
                    a: ({ children, ...props }) => <a className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>,
                    table: ({ children, ...props }) => (
                      <div className="overflow-x-auto my-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                        <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700" {...props}>{children}</table>
                      </div>
                    ),
                    thead: ({ children, ...props }) => <thead className="bg-neutral-50 dark:bg-neutral-800/50" {...props}>{children}</thead>,
                    th: ({ children, ...props }) => <th className="px-4 py-2.5 font-semibold text-left text-sm" {...props}>{children}</th>,
                    td: ({ children, ...props }) => <td className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 text-sm" {...props}>{children}</td>,
                    hr: () => <hr className="my-8 border-neutral-200 dark:border-neutral-800" />,
                    img: ({ src, alt, ...props }) => (
                      <img src={src} alt={alt || ''} className="max-w-full h-auto rounded-lg my-4" {...props} />
                    ),
                  }}
                >
                  {content ? content.replace(/\n/g, '  \n') : '*No content yet. Start writing in the editor.*'}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
