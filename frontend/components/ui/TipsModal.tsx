'use client';

import {
  X, Keyboard, Type, Table, Image, Users, FolderTree, Search, Trash2,
  Shield, Sigma, GripVertical, Code2, BookOpen, Share2, Download,
  Globe, UserCircle, Building2, Rocket,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface TipsModalProps { onClose: () => void; }

export default function TipsModal({ onClose }: TipsModalProps) {
  const { t } = useLanguage();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] pb-[5vh] animate-fade-in"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl max-h-[90vh] mx-4 overflow-y-auto bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] shadow-[var(--shadow-xl)] animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 h-14 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur z-10">
          <div className="flex items-center gap-2.5">
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

        {/* Content */}
        <div className="px-6 py-2 text-[13px] text-[var(--fg-secondary)]">

          {/* ── 시작하기 ── */}
          <Section icon={<Rocket size={14} />} title={t.guideGettingStarted}>
            <p className="text-[var(--fg-secondary)] leading-relaxed">{t.guideGettingStartedDesc}</p>
          </Section>

          <Divider />

          {/* ── 페이지 공유 ── */}
          <Section icon={<Share2 size={14} />} title={t.guideSharingTitle}>
            <Steps items={[
              t.guideSharingStep1,
              t.guideSharingStep2,
              t.guideSharingStep3,
              t.guideSharingStep4,
            ]} />
            <Note text={t.guideSharingRevoke} />
          </Section>

          <Divider />

          {/* ── 내보내기 ── */}
          <Section icon={<Download size={14} />} title={t.guideExportTitle}>
            <Steps items={[
              t.guideExportStep1,
              t.guideExportStep2,
              t.guideExportStep3,
            ]} />
          </Section>

          <Divider />

          {/* ── 언어 ── */}
          <Section icon={<Globe size={14} />} title={t.guideLangTitle}>
            <p className="text-[var(--fg-secondary)] leading-relaxed">{t.guideLangDesc}</p>
          </Section>

          <Divider />

          {/* ── 계정 & 프로필 ── */}
          <Section icon={<UserCircle size={14} />} title={t.guideAccountTitle}>
            <Steps items={[
              t.guideAccountStep1,
              t.guideAccountStep2,
              t.guideAccountStep3,
            ]} />
            <Note text={t.guideAccountPasswordNote} warning />
          </Section>

          <Divider />

          {/* ── 워크스페이스 ── */}
          <Section icon={<Building2 size={14} />} title={t.guideWorkspaceTitle}>
            <Steps items={[
              t.guideWorkspaceStep1,
              t.guideWorkspaceStep2,
              t.guideWorkspaceStep3,
              t.guideWorkspaceStep4,
            ]} />
          </Section>

          <Divider />

          {/* ── 검색 ── */}
          <Section icon={<Search size={14} />} title={t.guideSearchTitle}>
            <p className="leading-relaxed">{t.guideSearchDesc}</p>
          </Section>

          <Divider />

          {/* ── 휴지통 ── */}
          <Section icon={<Trash2 size={14} />} title={t.guideTrash}>
            <p className="leading-relaxed">{t.guideTrashDesc}</p>
          </Section>

          <Divider />

          {/* ── 페이지 & 하위 페이지 ── */}
          <Section icon={<FolderTree size={14} />} title={t.guidePagesSubpages}>
            <p className="leading-relaxed">{t.guidePagesSubpagesDesc}</p>
          </Section>

          <Divider />

          {/* ── 블록 순서 변경 ── */}
          <Section icon={<GripVertical size={14} />} title={t.guideBlockReorder}>
            <p className="leading-relaxed">{t.guideBlockReorderDesc}</p>
          </Section>

          <Divider />

          {/* ── 이미지 ── */}
          <Section icon={<Image size={14} />} title={t.guideImages}>
            <p className="leading-relaxed">{t.guideImagesDesc}</p>
          </Section>

          <Divider />

          {/* ── 표 ── */}
          <Section icon={<Table size={14} />} title={t.guideTables}>
            <p className="mb-2">{t.guideTablesDesc}</p>
            <ul className="list-disc pl-5 space-y-1 text-[var(--fg-tertiary)]">
              <li>{t.guideTablesAdd}</li>
              <li>{t.guideTablesHeader}</li>
              <li>{t.guideTablesMerge}</li>
              <li>{t.guideTablesResize}</li>
            </ul>
            <p className="mt-2">{t.guideTablesNav}</p>
          </Section>

          <Divider />

          {/* ── 코드 블록 ── */}
          <Section icon={<Code2 size={14} />} title={t.guideCodeBlocks}>
            <p className="leading-relaxed">{t.guideCodeBlocksDesc}</p>
          </Section>

          <Divider />

          {/* ── LaTeX 수식 ── */}
          <Section icon={<Sigma size={14} />} title={t.guideLatexMath}>
            <p className="text-[var(--fg-tertiary)] mb-3">{t.guideLatexIntro}</p>
            <SC keys="$e^2$" desc={t.guideInlineMath} />
            <SC keys="$$\frac{1}{2}$$" desc={t.guideBlockMath} />
            <p className="text-[var(--fg-tertiary)] mt-3">{t.guideLatexTip}</p>
          </Section>

          <Divider />

          {/* ── 슬래시 명령어 ── */}
          <Section icon={<Type size={14} />} title={t.guideSlashCommands}>
            <p className="text-[var(--fg-tertiary)] mb-3">{t.guideSlashIntro}</p>
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

          <Divider />

          {/* ── 키보드 단축키 ── */}
          <Section icon={<Keyboard size={14} />} title={t.guideKeyboardShortcuts}>
            <SC keys="Ctrl + B" desc={t.guideBold} />
            <SC keys="Ctrl + I" desc={t.guideItalic} />
            <SC keys="Ctrl + U" desc={t.guideUnderline} />
            <SC keys="Ctrl + Shift + X" desc={t.guideStrikethrough} />
            <SC keys="Ctrl + E" desc={t.guideInlineCode} />
            <SC keys="Ctrl + Z" desc={t.guideUndo} />
            <SC keys="Ctrl + Shift + Z" desc={t.guideRedo} />
            <SC keys="Ctrl + K" desc={t.guideSearch} />
          </Section>

          <Divider />

          {/* ── 마크다운 단축키 ── */}
          <Section icon={<Type size={14} />} title={t.guideMarkdownShortcuts}>
            <p className="text-[var(--fg-tertiary)] mb-3">{t.guideMarkdownIntro}</p>
            <SC keys="#" desc={t.guideH1} />
            <SC keys="##" desc={t.guideH2} />
            <SC keys="###" desc={t.guideH3} />
            <SC keys="-" desc={t.guideBulletList} />
            <SC keys="1." desc={t.guideNumberedList} />
            <SC keys="[]" desc={t.guideTaskList} />
            <SC keys=">" desc={t.guideBlockquote} />
            <SC keys="```" desc={t.guideCodeBlock} />
            <SC keys="---" desc={t.guideDivider} />
            <p className="text-[var(--fg-tertiary)] mt-4 mb-2 font-medium">{t.guideInlineFormatting}</p>
            <SC keys="**text**" desc={t.guideBoldMd} />
            <SC keys="*text*" desc={t.guideItalicMd} />
            <SC keys="~~text~~" desc={t.guideStrikethroughMd} />
            <SC keys="`code`" desc={t.guideInlineCodeMd} />
          </Section>

          <Divider />

          {/* ── 보안 ── */}
          <Section icon={<Shield size={14} />} title={t.guideSecurity} last>
            <p className="leading-relaxed">{t.guideSecurityDesc}</p>
          </Section>

        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children, last }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={`py-5 ${last ? '' : ''}`}>
      <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--fg-primary)] mb-3">
        <span className="w-6 h-6 rounded-md bg-[var(--bg-surface-3)] flex items-center justify-center text-[var(--fg-secondary)] flex-shrink-0">
          {icon}
        </span>
        {title}
      </h3>
      <div className="space-y-0.5 pl-1">{children}</div>
    </section>
  );
}

function Divider() {
  return <div className="border-t border-[var(--border-subtle)]" />;
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-1.5 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold flex items-center justify-center leading-none">
            {i + 1}
          </span>
          <span className="text-[var(--fg-secondary)] leading-snug">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Note({ text, warning }: { text: string; warning?: boolean }) {
  return (
    <div className={`mt-3 px-3 py-2.5 rounded-lg text-[12px] leading-relaxed border ${
      warning
        ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/20 text-amber-700 dark:text-amber-400'
        : 'bg-[var(--bg-surface-2)] border-[var(--border-subtle)] text-[var(--fg-tertiary)]'
    }`}>
      {text}
    </div>
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
