import type { FieldDef } from '@opervio/contracts';
import { Check, ExternalLink, Minus } from 'lucide-react';
import { formatNumber, isRtl } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Chip, Markdown, StatusPill } from '../app/primitives';

const STATUS_WORDS = new Set(['queued', 'running', 'working', 'waiting', 'done', 'idle', 'failed', 'cancelled', 'stopped']);

/** Status values get a neutral-to-positive progression by their position in the field's options. */
function StatusValue({ value, options }: { value: string; options?: string[] }) {
  if (STATUS_WORDS.has(value)) return <StatusPill status={value} />;
  const idx = options?.indexOf(value) ?? -1;
  const n = options?.length ?? 0;
  const tone = idx < 0 || n < 2 ? 'neutral' : idx === n - 1 ? 'positive' : idx >= n / 2 ? 'info' : 'neutral';
  return (
    <Chip tone={tone} className="max-w-full">
      <span className="truncate" dir="auto">
        {value}
      </span>
    </Chip>
  );
}

export function FieldValue({ field, value, full = false }: { field: FieldDef | undefined; value: unknown; full?: boolean }) {
  if (value === null || value === undefined || value === '') return <Minus className="size-3 text-ink-4" />;
  const type = field?.type ?? 'text';
  switch (type) {
    case 'status':
      return <StatusValue value={String(value)} options={field?.options} />;
    case 'tags':
      return (
        <span className="flex flex-wrap gap-1">
          {(Array.isArray(value) ? value : String(value).split(',')).map((t) => (
            <Chip key={String(t)}>{String(t).trim()}</Chip>
          ))}
        </span>
      );
    case 'url': {
      const s = String(value);
      let label = s;
      try {
        label = new URL(s).hostname.replace(/^www\./, '');
      } catch {
        /* keep */
      }
      return (
        <a href={s} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full items-center gap-1 text-brand-ink hover:underline">
          <span className="truncate">{full ? s : label}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
      );
    }
    case 'email':
      return (
        <a href={`mailto:${value}`} onClick={(e) => e.stopPropagation()} className="truncate text-brand-ink hover:underline">
          {String(value)}
        </a>
      );
    case 'boolean':
      return value === true || value === 'true' ? <Check className="size-4 text-positive" /> : <Minus className="size-3 text-ink-4" />;
    case 'number':
      return <span className="num">{formatNumber(value)}</span>;
    case 'currency':
      return <span className="num">{formatNumber(value, 'currency')}</span>;
    case 'percent':
      return <span className="num">{formatNumber(value, 'percent')}</span>;
    case 'date':
    case 'datetime': {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return <span>{String(value)}</span>;
      return (
        <span className="num whitespace-nowrap">
          {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })}
          {type === 'datetime' ? ` ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
      );
    }
    case 'longtext':
      return full ? <Markdown className="text-[13px]">{String(value)}</Markdown> : <span className={cn('line-clamp-2')} dir="auto">{String(value)}</span>;
    default:
      return (
        <span className={cn(!full && 'truncate')} dir={isRtl(String(value)) ? 'rtl' : undefined}>
          {String(value)}
        </span>
      );
  }
}
