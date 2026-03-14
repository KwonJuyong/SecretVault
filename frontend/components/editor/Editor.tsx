'use client';

import { useState } from 'react';
import BlockEditor from './BlockEditor';

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
  const [showIconPicker, setShowIconPicker] = useState(false);

  const commonEmojis = ['', '\u{1F4DD}', '\u{1F4CB}', '\u{1F4D6}', '\u{1F4DA}', '\u{1F4A1}', '\u{1F680}', '\u2B50', '\u{1F525}', '\u{1F4E6}', '\u{1F50D}', '\u{1F512}', '\u{1F3AF}', '\u2705', '\u26A0\uFE0F', '\u{1F4AC}', '\u{1F4BB}', '\u{1F9EA}', '\u{1F4CA}', '\u{1F4C1}'];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full px-6 sm:px-16 py-12">
        {/* Icon */}
        <div className="relative mb-4 group/icon inline-block">
          <button
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="text-5xl hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl p-1.5 transition"
            title="Change icon"
          >
            {icon || '\u{1F4C4}'}
          </button>
          {showIconPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowIconPicker(false)} />
              <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-2.5 grid grid-cols-5 gap-1 w-56">
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

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={e => onChangeTitle(e.target.value)}
          placeholder="Untitled"
          className="w-full text-4xl font-extrabold text-neutral-900 dark:text-white bg-transparent border-none outline-none placeholder-neutral-300 dark:placeholder-neutral-600 mb-1"
        />

        {/* Hint text */}
        <p className="text-[13px] text-neutral-300 dark:text-neutral-600 mb-8">
          Type <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[11px] font-mono">/</kbd> for commands, <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[11px] font-mono">#</kbd> for headings
        </p>

        {/* Block Editor */}
        <BlockEditor content={content} onChangeContent={onChangeContent} />
      </div>
    </div>
  );
}
