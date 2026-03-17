'use client';

import { X, Keyboard, Type, Table, Image, Users, FolderTree, Search, Trash2, Shield } from 'lucide-react';

interface TipsModalProps { onClose: () => void; }

export default function TipsModal({ onClose }: TipsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] pb-[5vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-neutral-200" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-neutral-900">User Guide</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-6 text-sm text-neutral-700">
          <Section icon={<Keyboard size={16} className="text-blue-600" />} title="Keyboard Shortcuts">
            <SC keys="Ctrl + B" desc="Bold" /><SC keys="Ctrl + I" desc="Italic" /><SC keys="Ctrl + U" desc="Underline" />
            <SC keys="Ctrl + Shift + X" desc="Strikethrough" /><SC keys="Ctrl + E" desc="Inline code" />
            <SC keys="Ctrl + Z" desc="Undo" /><SC keys="Ctrl + Shift + Z" desc="Redo" /><SC keys="Ctrl + K" desc="Search pages" />
          </Section>
          <Section icon={<Type size={16} className="text-blue-600" />} title="Markdown Shortcuts">
            <p className="text-neutral-500 mb-2">Type at start of line + Space:</p>
            <SC keys="#" desc="Heading 1" /><SC keys="##" desc="Heading 2" /><SC keys="###" desc="Heading 3" />
            <SC keys="-" desc="Bullet list" /><SC keys="1." desc="Numbered list" /><SC keys="[]" desc="Task list" />
            <SC keys=">" desc="Blockquote" /><SC keys="```" desc="Code block" /><SC keys="---" desc="Divider" />
            <p className="text-neutral-500 mt-2">Inline (applied immediately):</p>
            <SC keys="**text**" desc="Bold" /><SC keys="*text*" desc="Italic" /><SC keys="~~text~~" desc="Strikethrough" /><SC keys="`code`" desc="Inline code" />
          </Section>
          <Section icon={<Table size={16} className="text-blue-600" />} title="Tables">
            <p>Click the <strong>Table</strong> button to insert. Use <strong>Tab</strong>/<strong>Shift+Tab</strong> to navigate cells. Row/column controls appear above the editor when inside a table.</p>
          </Section>
          <Section icon={<Image size={16} className="text-blue-600" />} title="Images">
            <p><strong>Paste</strong> (Ctrl+V), <strong>drag & drop</strong>, or use the <strong>Image</strong> toolbar button. Images are encrypted with your content.</p>
          </Section>
          <Section icon={<FolderTree size={16} className="text-blue-600" />} title="Pages">
            <p>Click <strong>+</strong> to create pages. Hover a page and click <strong>+</strong> for sub-pages. Arrow icons expand/collapse children.</p>
          </Section>
          <Section icon={<Search size={16} className="text-blue-600" />} title="Search">
            <p>Press <strong>Ctrl+K</strong> to search. Arrow keys navigate, Enter selects.</p>
          </Section>
          <Section icon={<Trash2 size={16} className="text-blue-600" />} title="Trash">
            <p>Deleted pages go to Trash. Restore or permanently delete from the sidebar.</p>
          </Section>
          <Section icon={<Users size={16} className="text-blue-600" />} title="Workspace Collaboration">
            <p>Each user gets a personal workspace. Owners/admins can invite members via Workspace Settings. Roles: <strong>Owner</strong> (full control), <strong>Admin</strong> (manage members), <strong>Member</strong> (read/write).</p>
          </Section>
          <Section icon={<Shield size={16} className="text-blue-600" />} title="Security">
            <p><strong>Zero-knowledge encryption</strong>: content is encrypted in your browser. The server cannot read your data. If you forget your password, data cannot be recovered.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-900 mb-3">{icon} {title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function SC({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-neutral-50">
      <span className="text-neutral-600">{desc}</span>
      <kbd className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 border border-neutral-200">{keys}</kbd>
    </div>
  );
}
