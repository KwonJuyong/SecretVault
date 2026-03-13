'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Eye, Edit3, Columns } from 'lucide-react';

type ViewMode = 'edit' | 'preview' | 'split';

interface EditorProps {
  title: string;
  content: string;
  icon: string;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onChangeIcon: (icon: string) => void;
}

export default function Editor({
  title, content, icon,
  onChangeTitle, onChangeContent, onChangeIcon,
}: EditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  const commonEmojis = ['', '1F4DD', '1F4CB', '1F4D6', '1F4DA', '1F4A1', '1F680', '2B50', '1F525', '1F4E6', '1F50D', '1F512', '1F3AF', '2705', '26A0', '1F4AC'];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
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

      {/* Editor Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Edit Pane */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`flex flex-col overflow-y-auto ${viewMode === 'split' ? 'w-1/2 border-r border-neutral-100 dark:border-neutral-800' : 'w-full'}`}>
            <div className="max-w-3xl mx-auto w-full px-6 sm:px-12 py-10">
              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={e => onChangeTitle(e.target.value)}
                placeholder="Untitled"
                className="w-full text-4xl font-extrabold text-neutral-900 dark:text-white bg-transparent border-none outline-none placeholder-neutral-300 dark:placeholder-neutral-600 mb-4"
              />

              {/* Content */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => onChangeContent(e.target.value)}
                placeholder="Start writing... (Markdown supported)"
                className="w-full min-h-[60vh] text-base leading-relaxed text-neutral-700 dark:text-neutral-300 bg-transparent border-none outline-none resize-none placeholder-neutral-300 dark:placeholder-neutral-600 font-[inherit]"
              />
            </div>
          </div>
        )}

        {/* Preview Pane */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`overflow-y-auto ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="max-w-3xl mx-auto w-full px-6 sm:px-12 py-10">
              <h1 className="text-4xl font-extrabold text-neutral-900 dark:text-white mb-8 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                {title || 'Untitled'}
              </h1>
              <div className="max-w-none text-neutral-800 dark:text-neutral-200 leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    h1: ({ children, ...props }) => <h1 className="text-2xl font-bold mt-8 mb-4 pb-2 border-b border-neutral-200 dark:border-neutral-700" {...props}>{children}</h1>,
                    h2: ({ children, ...props }) => <h2 className="text-xl font-bold mt-6 mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800" {...props}>{children}</h2>,
                    h3: ({ children, ...props }) => <h3 className="text-lg font-semibold mt-5 mb-2" {...props}>{children}</h3>,
                    p: ({ children, ...props }) => <p className="mb-4 leading-relaxed whitespace-pre-wrap" {...props}>{children}</p>,
                    code: ({ className, children, ...props }) => {
                      const isBlock = className?.includes('language-');
                      if (isBlock) {
                        return (
                          <pre className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 overflow-x-auto my-4">
                            <code className={`text-sm font-mono ${className}`} {...props}>{children}</code>
                          </pre>
                        );
                      }
                      return <code className="bg-neutral-100 dark:bg-neutral-800 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded-md text-sm font-mono" {...props}>{children}</code>;
                    },
                    blockquote: ({ children, ...props }) => (
                      <blockquote className="border-l-4 border-blue-500 pl-4 my-4 text-neutral-600 dark:text-neutral-400 italic" {...props}>{children}</blockquote>
                    ),
                    ul: ({ children, ...props }) => <ul className="list-disc pl-6 mb-4 space-y-1" {...props}>{children}</ul>,
                    ol: ({ children, ...props }) => <ol className="list-decimal pl-6 mb-4 space-y-1" {...props}>{children}</ol>,
                    a: ({ children, ...props }) => <a className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800" {...props}>{children}</a>,
                    table: ({ children, ...props }) => (
                      <div className="overflow-x-auto my-4">
                        <table className="min-w-full border border-neutral-200 dark:border-neutral-700 rounded-lg" {...props}>{children}</table>
                      </div>
                    ),
                    th: ({ children, ...props }) => <th className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 font-semibold text-left border-b border-neutral-200 dark:border-neutral-700" {...props}>{children}</th>,
                    td: ({ children, ...props }) => <td className="px-4 py-2 border-b border-neutral-100 dark:border-neutral-800" {...props}>{children}</td>,
                  }}
                >
                  {content ? content.replace(/\n/g, '  \n') : '*No content yet.*'}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
