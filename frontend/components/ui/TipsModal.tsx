'use client';

import {
  X, Keyboard, Type, Table, Image, Users, FolderTree, Search, Trash2, Shield, Sigma, GripVertical, Code2, BookOpen,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface TipsModalProps { onClose: () => void; }

export default function TipsModal({ onClose }: TipsModalProps) {
  const { t } = useLanguage();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh] pb-[6vh] animate-fade-in"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[88vh] mx-4 overflow-y-auto bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] shadow-[var(--shadow-xl)] animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between px-5 h-14 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
              <BookOpen size={15} className="text-[var(--accent)]" />
            </div>
            <h2 className="text-[15px] font-bold text-[var(--fg-primary)]">{t.userGuide}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-5 space-y-7 text-[13px] text-[var(--fg-secondary)]">
          <Section icon={<Type size={15} />} title={t.guideSlashCommands}>
            <p className="text-[var(--fg-tertiary)] mb-2">{t.guideSlashIntro}</p>
            <SC keys="/heading 1~3" desc={t.guideSlashHeading} />
            <SC keys="/bullet" desc={t.guideSlashBullet} />
            <SC keys="/numbered" desc={t.guideSlashNumbered} />
            <SC keys="/todo" desc={t.guideSlashTodo} />
            <SC keys="/quote" desc={t.guideSlashQuote} />
            <SC keys="/code" desc={t.guideSlashCode} />
            <SC keys="/table" desc={t.guideSlashTable} />
            <SC keys="/image" desc={t.guideSlashImage} />
            <SC keys="/divider" desc={t.guideSlashDivider} />
            <SC keys="/math" desc={t.guideSlashMath} />
            <SC keys="/sub-page" desc={t.guideSlashSubpage} />
          </Section>

          <Section icon={<Keyboard size={15} />} title={t.guideKeyboardShortcuts}>
            <SC keys="Ctrl + B" desc={t.guideBold} />
            <SC keys="Ctrl + I" desc={t.guideItalic} />
            <SC keys="Ctrl + U" desc={t.guideUnderline} />
            <SC keys="Ctrl + Shift + X" desc={t.guideStrikethrough} />
            <SC keys="Ctrl + E" desc={t.guideInlineCode} />
            <SC keys="Ctrl + Z" desc={t.guideUndo} />
            <SC keys="Ctrl + Shift + Z" desc={t.guideRedo} />
            <SC keys="Ctrl + K" desc={t.guideSearch} />
          </Section>

          <Section icon={<Type size={15} />} title={t.guideMarkdownShortcuts}>
            <p className="text-[var(--fg-tertiary)] mb-2">{t.guideMarkdownIntro}</p>
            <SC keys="#" desc={t.guideH1} />
            <SC keys="##" desc={t.guideH2} />
            <SC keys="###" desc={t.guideH3} />
            <SC keys="-" desc={t.guideBulletList} />
            <SC keys="1." desc={t.guideNumberedList} />
            <SC keys="[]" desc={t.guideTaskList} />
            <SC keys=">" desc={t.guideBlockquote} />
            <SC keys="```" desc={t.guideCodeBlock} />
            <SC keys="---" desc={t.guideDivider} />
            <p className="text-[var(--fg-tertiary)] mt-3 mb-1">{t.guideInlineFormatting}</p>
            <SC keys="**text**" desc={t.guideBoldMd} />
            <SC keys="*text*" desc={t.guideItalicMd} />
            <SC keys="~~text~~" desc={t.guideStrikethroughMd} />
            <SC keys="`code`" desc={t.guideInlineCodeMd} />
          </Section>

          <Section icon={<Sigma size={15} />} title={t.guideLatexMath}>
            <p className="text-[var(--fg-tertiary)] mb-2">{t.guideLatexIntro}</p>
            <SC keys="$e^2$" desc={t.guideInlineMath} />
            <SC keys="$$\frac{1}{2}$$" desc={t.guideBlockMath} />
            <p className="text-[var(--fg-tertiary)] mt-2">{t.guideLatexTip}</p>
          </Section>

          <Section icon={<Code2 size={15} />} title={t.guideCodeBlocks}>
            <p>{t.guideCodeBlocksDesc}</p>
          </Section>

          <Section icon={<Table size={15} />} title={t.guideTables}>
            <p>{t.guideTablesDesc}</p>
            <ul className="list-disc pl-5 mt-1.5 space-y-0.5 text-[var(--fg-tertiary)]">
              <li>{t.guideTablesAdd}</li>
              <li>{t.guideTablesHeader}</li>
              <li>{t.guideTablesMerge}</li>
              <li>{t.guideTablesResize}</li>
            </ul>
            <p className="mt-1.5">{t.guideTablesNav}</p>
          </Section>

          <Section icon={<GripVertical size={15} />} title={t.guideBlockReorder}>
            <p>{t.guideBlockReorderDesc}</p>
          </Section>

          <Section icon={<Image size={15} />} title={t.guideImages}>
            <p>{t.guideImagesDesc}</p>
          </Section>

          <Section icon={<FolderTree size={15} />} title={t.guidePagesSubpages}>
            <p>{t.guidePagesSubpagesDesc}</p>
          </Section>

          <Section icon={<Search size={15} />} title={t.guideSearchTitle}>
            <p>{t.guideSearchDesc}</p>
          </Section>

          <Section icon={<Trash2 size={15} />} title={t.guideTrash}>
            <p>{t.guideTrashDesc}</p>
          </Section>

          <Section icon={<Users size={15} />} title={t.guideWorkspaceProfile}>
            <p>{t.guideWorkspaceProfileDesc}</p>
          </Section>

          <Section icon={<Shield size={15} />} title={t.guideSecurity}>
            <p>{t.guideSecurityDesc}</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--fg-primary)] mb-3">
        <span className="text-[var(--fg-tertiary)]">{icon}</span> {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function SC({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[var(--bg-hover)]">
      <span className="text-[var(--fg-secondary)]">{desc}</span>
      <kbd className="sc-kbd">{keys}</kbd>
    </div>
  );
}
