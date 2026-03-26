'use client';

import { X, Keyboard, Type, Table, Image, Users, FolderTree, Search, Trash2, Shield, Sigma, GripVertical, Code2 } from 'lucide-react';

interface TipsModalProps { onClose: () => void; }

export default function TipsModal({ onClose }: TipsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] pb-[5vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">User Guide</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-6 text-sm text-neutral-700 dark:text-neutral-300">
          <Section icon={<Type size={16} className="text-neutral-500" />} title="Slash Commands">
            <p className="text-neutral-500 dark:text-neutral-400 mb-2">Type <kbd className="sc-kbd">/</kbd> at the start of an empty line:</p>
            <SC keys="/heading 1~3" desc="Headings (H1, H2, H3)" />
            <SC keys="/bullet" desc="Bullet list" />
            <SC keys="/numbered" desc="Numbered list" />
            <SC keys="/todo" desc="Task list with checkboxes" />
            <SC keys="/quote" desc="Blockquote" />
            <SC keys="/code" desc="Code block (with syntax highlighting)" />
            <SC keys="/table" desc="Insert 3x3 table" />
            <SC keys="/image" desc="Upload an image" />
            <SC keys="/divider" desc="Horizontal divider" />
            <SC keys="/math" desc="Inline or Block LaTeX equation" />
            <SC keys="/sub-page" desc="Create & link a sub-page" />
          </Section>

          <Section icon={<Keyboard size={16} className="text-neutral-500" />} title="Keyboard Shortcuts">
            <SC keys="Ctrl + B" desc="Bold" />
            <SC keys="Ctrl + I" desc="Italic" />
            <SC keys="Ctrl + U" desc="Underline" />
            <SC keys="Ctrl + Shift + X" desc="Strikethrough" />
            <SC keys="Ctrl + E" desc="Inline code" />
            <SC keys="Ctrl + Z" desc="Undo" />
            <SC keys="Ctrl + Shift + Z" desc="Redo" />
            <SC keys="Ctrl + K" desc="Search pages" />
          </Section>

          <Section icon={<Type size={16} className="text-neutral-500" />} title="Markdown Shortcuts">
            <p className="text-neutral-500 dark:text-neutral-400 mb-2">Type at start of line + Space:</p>
            <SC keys="#" desc="Heading 1" />
            <SC keys="##" desc="Heading 2" />
            <SC keys="###" desc="Heading 3" />
            <SC keys="-" desc="Bullet list" />
            <SC keys="1." desc="Numbered list" />
            <SC keys="[]" desc="Task list" />
            <SC keys=">" desc="Blockquote" />
            <SC keys="```" desc="Code block" />
            <SC keys="---" desc="Divider" />
            <p className="text-neutral-500 dark:text-neutral-400 mt-2">Inline formatting:</p>
            <SC keys="**text**" desc="Bold" />
            <SC keys="*text*" desc="Italic" />
            <SC keys="~~text~~" desc="Strikethrough" />
            <SC keys="`code`" desc="Inline code" />
          </Section>

          <Section icon={<Sigma size={16} className="text-neutral-500" />} title="LaTeX Math">
            <p className="text-neutral-500 dark:text-neutral-400 mb-2">Type math between dollar signs:</p>
            <SC keys="$e^2$" desc="Inline math (renders next to text)" />
            <SC keys="$$\frac{1}{2}$$" desc="Block math (centered display)" />
            <p className="text-neutral-500 dark:text-neutral-400 mt-2">Or use <kbd className="sc-kbd">/math</kbd> from the slash menu. Click any math to edit it.</p>
          </Section>

          <Section icon={<Code2 size={16} className="text-neutral-500" />} title="Code Blocks">
            <p>Type <kbd className="sc-kbd">/code</kbd> or <kbd className="sc-kbd">```</kbd> to insert. A language selector appears in the toolbar when editing a code block. Supports syntax highlighting for 25+ languages.</p>
          </Section>

          <Section icon={<Table size={16} className="text-neutral-500" />} title="Tables">
            <p>Type <kbd className="sc-kbd">/table</kbd> to insert. Controls appear in the toolbar:</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5 text-neutral-500 dark:text-neutral-400">
              <li>Add/remove rows and columns</li>
              <li>Toggle header row</li>
              <li>Merge and split cells</li>
              <li>Drag column borders to resize</li>
            </ul>
            <p className="mt-1">Use <strong>Tab</strong> / <strong>Shift+Tab</strong> to navigate cells.</p>
          </Section>

          <Section icon={<GripVertical size={16} className="text-neutral-500" />} title="Block Reordering">
            <p>Hover over any block (paragraph, heading, code, etc.) to see <strong>&#9650; &#9660;</strong> buttons on the left. Click to move the block up or down.</p>
          </Section>

          <Section icon={<Image size={16} className="text-neutral-500" />} title="Images">
            <p><strong>Paste</strong> (Ctrl+V), <strong>drag & drop</strong>, or use <kbd className="sc-kbd">/image</kbd>. Images are encrypted with your content.</p>
          </Section>

          <Section icon={<FolderTree size={16} className="text-neutral-500" />} title="Pages & Sub-pages">
            <p>Click <strong>+</strong> in sidebar to create pages. Use <kbd className="sc-kbd">/sub-page</kbd> to create a linked sub-page at cursor position and navigate to it directly. Sub-pages appear as clickable links in the document. Expand/collapse in sidebar.</p>
          </Section>

          <Section icon={<Search size={16} className="text-neutral-500" />} title="Search">
            <p>Press <strong>Ctrl+K</strong> to search. Arrow keys navigate, Enter selects.</p>
          </Section>

          <Section icon={<Trash2 size={16} className="text-neutral-500" />} title="Trash">
            <p>Deleted pages go to Trash. Restore or permanently delete from the sidebar.</p>
          </Section>

          <Section icon={<Users size={16} className="text-neutral-500" />} title="Workspace & Profile">
            <p>Each user gets a personal workspace. Owners/admins can invite members via Workspace Settings. Click your name at the bottom of the sidebar to edit your display name or sign out.</p>
          </Section>

          <Section icon={<Shield size={16} className="text-neutral-500" />} title="Security">
            <p><strong>Zero-knowledge encryption</strong>: all content is encrypted in your browser before being sent to the server. The server cannot read your data. If you forget your password, data cannot be recovered.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white mb-3">{icon} {title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function SC({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800">
      <span className="text-neutral-600 dark:text-neutral-300">{desc}</span>
      <kbd className="sc-kbd">{keys}</kbd>
    </div>
  );
}
