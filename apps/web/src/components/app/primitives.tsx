import type { AgentStatus, ArtifactType, TaskStatus } from '@opervio/contracts';
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CirclePause,
  CircleSlash,
  CircleX,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  GitCompare,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useIsDark } from '@/hooks/use-theme';
import { isRtl } from '@/lib/format';
import { cn } from '@/lib/utils';

/** A surface that groups related content. Hierarchy comes from type and spacing, not boxes-in-boxes. */
export function Panel({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('min-w-0 rounded-xl border border-border bg-surface shadow-sm', className)} {...props}>
      {children}
    </section>
  );
}

export function PanelHeader({ title, meta, actions, className }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn('flex min-h-11 items-center gap-2 px-4 pt-3 pb-2', className)}>
      <h2 className="text-[13px] font-semibold tracking-[-0.005em] text-foreground">{title}</h2>
      {meta !== undefined && <span className="num text-[12px] text-ink-3">{meta}</span>}
      <div className="ms-auto flex items-center gap-1">{actions}</div>
    </header>
  );
}

export function EmptyState({ icon: Icon, title, hint, action, className }: { icon?: LucideIcon; title: string; hint?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-start gap-1.5 px-4 py-6 text-[13px]', className)}>
      {Icon && <Icon className="mb-1 size-4 text-ink-3" strokeWidth={1.75} />}
      <p className="font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-[46ch] text-ink-3">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'info' | 'live';
const TONE: Record<Tone, string> = {
  neutral: 'bg-muted text-ink-2',
  positive: 'bg-positive-soft text-positive',
  warning: 'bg-warning-soft text-warning',
  negative: 'bg-negative-soft text-destructive',
  info: 'bg-brand-soft text-brand-ink',
  live: 'bg-brand-soft text-brand-ink',
};

export function Chip({ tone = 'neutral', icon: Icon, children, className, title }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11.5px] font-medium whitespace-nowrap', TONE[tone], className)}>
      {Icon && <Icon className="size-3" strokeWidth={2} />}
      {children}
    </span>
  );
}

/** Status always carries an icon + label — never color alone. */
const STATUS: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  queued: { label: 'Queued', tone: 'neutral', icon: CircleDashed },
  running: { label: 'Working', tone: 'live', icon: CircleDot },
  working: { label: 'Working', tone: 'live', icon: CircleDot },
  waiting: { label: 'Waiting', tone: 'warning', icon: CirclePause },
  done: { label: 'Done', tone: 'positive', icon: CircleCheck },
  idle: { label: 'Idle', tone: 'neutral', icon: CircleDashed },
  failed: { label: 'Failed', tone: 'negative', icon: CircleX },
  cancelled: { label: 'Stopped', tone: 'neutral', icon: CircleSlash },
  stopped: { label: 'Stopped', tone: 'neutral', icon: CircleSlash },
  complete: { label: 'Verified', tone: 'positive', icon: CircleCheck },
  incomplete: { label: 'Incomplete', tone: 'warning', icon: CircleAlert },
  needs_founder: { label: 'Needs you', tone: 'warning', icon: CircleAlert },
};

export function StatusPill({ status, className }: { status: TaskStatus | AgentStatus | string; className?: string }) {
  const s = STATUS[status] ?? { label: status, tone: 'neutral' as Tone, icon: CircleDashed };
  return (
    <Chip tone={s.tone} icon={s.icon} className={className}>
      {s.label}
    </Chip>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return <span className={cn('live-dot inline-block size-1.5 shrink-0 rounded-full bg-positive', className)} aria-hidden />;
}

/** Noor's light. Glows only while she (or the team) is working. */
export function NoorMark({ size = 22, live = false, className }: { size?: number; live?: boolean; className?: string }) {
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center rounded-full', live && 'noor-live', className)}
      style={{
        width: size,
        height: size,
        background: 'radial-gradient(circle at 35% 30%, color-mix(in oklch, var(--brand) 55%, white) 0%, var(--brand) 55%, color-mix(in oklch, var(--brand) 70%, black) 100%)',
      }}
      aria-hidden
    >
      <span className="rounded-full bg-white/95" style={{ width: size * 0.32, height: size * 0.32 }} />
    </span>
  );
}

const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** Agents get a person-like monogram with a quiet, stable tint derived from their name. */
export function AgentAvatar({ name, size = 28, working = false, className }: { name: string; size?: number; working?: boolean; className?: string }) {
  const h = hue(name);
  const dark = useIsDark();
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center rounded-full font-semibold select-none', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: dark ? `oklch(0.32 0.045 ${h})` : `oklch(0.93 0.035 ${h})`,
        color: dark ? `oklch(0.86 0.06 ${h})` : `oklch(0.38 0.08 ${h})`,
      }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
      {working && <span className="live-dot absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-surface bg-positive" />}
    </span>
  );
}

const FILE: Record<ArtifactType, { icon: LucideIcon; label: string; color: string }> = {
  xlsx: { icon: FileSpreadsheet, label: 'XLSX', color: 'text-[#1a8a5c]' },
  csv: { icon: FileSpreadsheet, label: 'CSV', color: 'text-[#1a8a5c]' },
  pdf: { icon: FileType2, label: 'PDF', color: 'text-[#d23f2c]' },
  pptx: { icon: Presentation, label: 'PPTX', color: 'text-[#d9661f]' },
  docx: { icon: FileText, label: 'DOCX', color: 'text-[#2a78d6]' },
  md: { icon: FileText, label: 'MD', color: 'text-ink-2' },
  txt: { icon: FileText, label: 'TXT', color: 'text-ink-2' },
  image: { icon: FileImage, label: 'Image', color: 'text-[#9b59b6]' },
  code: { icon: FileCode2, label: 'Code', color: 'text-ink-2' },
  json: { icon: FileCode2, label: 'JSON', color: 'text-ink-2' },
  html: { icon: FileCode2, label: 'HTML', color: 'text-ink-2' },
  diff: { icon: GitCompare, label: 'Diff', color: 'text-[#2a78d6]' },
  other: { icon: FileText, label: 'File', color: 'text-ink-2' },
};

export const fileMeta = (t: ArtifactType) => FILE[t] ?? FILE.other;

export function FileGlyph({ type, size = 32, className }: { type: ArtifactType; size?: number; className?: string }) {
  const m = fileMeta(type);
  return (
    <span className={cn('inline-grid shrink-0 place-items-center rounded-lg border border-border bg-surface-2', className)} style={{ width: size, height: size }}>
      <m.icon className={cn(m.color)} style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.75} />
    </span>
  );
}

/** AI text: direction follows the content (Egyptian Arabic or English). Raw HTML is never rendered. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div dir={isRtl(children) ? 'rtl' : 'ltr'} className={cn('prose-opervio', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ node: _n, ...p }) => <a {...p} target="_blank" rel="noreferrer" /> }}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export function AutoDir({ text, className, as: As = 'span' }: { text: string; className?: string; as?: 'span' | 'p' | 'div' | 'h1' | 'h2' }) {
  return (
    <As dir={isRtl(text) ? 'rtl' : undefined} className={className}>
      {text}
    </As>
  );
}

export function ProgressBar({ value, max, className, tone = 'brand' }: { value: number; max: number; className?: string; tone?: 'brand' | 'positive' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', tone === 'brand' ? 'bg-brand' : 'bg-positive')} style={{ width: `${pct}%` }} />
    </div>
  );
}
