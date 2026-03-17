'use client';

import { useState, useCallback } from 'react';
import TiptapEditor from './TiptapEditor';

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

  const handleContentChange = useCallback((html: string) => {
    onChangeContent(html);
  }, [onChangeContent]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="max-w-3xl mx-auto w-full px-6 sm:px-12 pt-8 pb-2 bg-white">
        <div className="relative mb-3 inline-block">
          <button
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="text-4xl hover:bg-neutral-100 rounded-xl p-1 transition"
            title="Change icon"
          >
            {icon || '\u{1F4C4}'}
          </button>
          {showIconPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowIconPicker(false)} />
              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-neutral-200 p-2.5 grid grid-cols-5 gap-1 w-56">
                {commonEmojis.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => { onChangeIcon(emoji); setShowIconPicker(false); }}
                    className="text-xl p-2 rounded-lg hover:bg-neutral-100 transition"
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
          className="w-full text-4xl font-extrabold text-neutral-900 bg-transparent border-none outline-none placeholder-neutral-300 mb-1"
        />
      </div>

      <TiptapEditor content={content} onChange={handleContentChange} />
    </div>
  );
}
