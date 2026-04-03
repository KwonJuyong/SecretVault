'use client';

import { X, Keyboard, Type, Table, Image, Users, FolderTree, Search, Trash2, Shield, Sigma, GripVertical, Code2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface TipsModalProps { onClose: () => void; }

export default function TipsModal({ onClose }: TipsModalProps) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] pb-[5vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{t.userGuide}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-6 text-sm text-neutral-700 dark:text-neutral-300">
          <Section icon={<Type size={16} className="text-neutral-500" />} title={t.guideSlashCommands}>
            <p className="text-neutral-500 dark:text-neutral-400 mb-2">{t.guideSlashIntro}</p>
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

          <Section icon={<Keyboard size={16} className="text-neutral-500" />} title={t.guideKeyboardShortcuts}>
            <SC keys="Ctrl + B" desc={t.guideBold} />
            <SC keys="Ctrl + I" desc={t.guideItalic} />
            <SC keys="Ctrl + U" desc={t.guideUnderline} />
            <SC keys="Ctrl + Shift + X" desc={t.guideStrikethrough} />
            <SC keys="Ctrl + E" desc={t.guideInlineCode} />
            <SC keys="Ctrl + Z" desc={t.guideUndo} />
            <SC keys="Ctrl + Shift + Z" desc={t.guideRedo} />
            <SC keys="Ctrl + K" desc={t.guideSearch} />
          </Section>

          <Section icon={<Type size={16} className="text-neutral-500" />} title={t.guideMarkdownShortcuts}>
            <p className="text-neutral-500 dark:text-neutral-400 mb-2">{t.guideMarkdownIntro}</p>
            <SC keys="#" desc={t.guideH1} />
            <SC keys="##" desc={t.guideH2} />
            <SC keys="###" desc={t.guideH3} />
            <SC keys="-" desc={t.guideBulletList} />
            <SC keys="1." desc={t.guideNumberedList} />
            <SC keys="[]" desc={t.guideTaskList} />
            <SC keys=">" desc={t.guideBlockquote} />
            <SC keys="```" desc={t.guideCodeBlock} />
            <SC keys="---" desc={t.guideDivider} />
            <p className="text-neutral-500 dark:text-neutral-400 mt-2">{t.guideInlineFormatting}</p>
            <SC keys="**text**" desc={t.guideBoldMd} />
            <SC keys="*text*" desc={t.guideItalicMd} />
            <SC keys="~~text~~" desc={t.guideStrikethroughMd} />
            <SC keys="`code`" desc={t.guideInlineCodeMd} />
          </Section>

          <Section icon={<Sigma size={16} className="text-neutral-500" />} title={t.guideLatexMath}>
            <p className="text-neutral-500 dark:text-neutral-400 mb-2">{t.guideLatexIntro}</p>
            <SC keys="$e^2$" desc={t.guideInlineMath} />
            <SC keys="$$\frac{1}{2}$$" desc={t.guideBlockMath} />
            <p className="text-neutral-500 dark:text-neutral-400 mt-2">{t.guideLatexTip}</p>
          </Section>

          <Section icon={<Code2 size={16} className="text-neutral-500" />} title={t.guideCodeBlocks}>
            <p>{t.guideCodeBlocksDesc}</p>
          </Section>

          <Section icon={<Table size={16} className="text-neutral-500" />} title={t.guideTables}>
            <p>{t.guideTablesDesc}</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5 text-neutral-500 dark:text-neutral-400">
              <li>{t.guideTablesAdd}</li>
              <li>{t.guideTablesHeader}</li>
              <li>{t.guideTablesMerge}</li>
              <li>{t.guideTablesResize}</li>
            </ul>
            <p className="mt-1">{t.guideTablesNav}</p>
          </Section>

          <Section icon={<GripVertical size={16} className="text-neutral-500" />} title={t.guideBlockReorder}>
            <p>{t.guideBlockReorderDesc}</p>
          </Section>

          <Section icon={<Image size={16} className="text-neutral-500" />} title={t.guideImages}>
            <p>{t.guideImagesDesc}</p>
          </Section>

          <Section icon={<FolderTree size={16} className="text-neutral-500" />} title={t.guidePagesSubpages}>
            <p>{t.guidePagesSubpagesDesc}</p>
          </Section>

          <Section icon={<Search size={16} className="text-neutral-500" />} title={t.guideSearchTitle}>
            <p>{t.guideSearchDesc}</p>
          </Section>

          <Section icon={<Trash2 size={16} className="text-neutral-500" />} title={t.guideTrash}>
            <p>{t.guideTrashDesc}</p>
          </Section>

          <Section icon={<Users size={16} className="text-neutral-500" />} title={t.guideWorkspaceProfile}>
            <p>{t.guideWorkspaceProfileDesc}</p>
          </Section>

          <Section icon={<Shield size={16} className="text-neutral-500" />} title={t.guideSecurity}>
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
