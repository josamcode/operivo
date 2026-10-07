import { t } from '@/lib/i18n';
import type { KpiItem, SectionOf } from '@opervio/contracts';
import { useCallback, type ReactNode } from 'react';
import { formatNumber } from '@/lib/format';
import { useAggregate, useMetric } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { EChart, tooltipBase, type ChartTheme } from '../app/chart';
import { AutoDir, Chip, Markdown, Panel, ProgressBar } from '../app/primitives';
import { usePageCtx } from './context';

export function Frame({ title, description, children, className, bare }: { title?: string; description?: string; children: ReactNode; className?: string; bare?: boolean }) {
  return (
    <Panel className={cn('flex flex-col', className)}>
      {(title || description) && (
        <header className="px-4 pt-3.5 pb-1">
          {title && <AutoDir as="h2" text={title} className="text-[13px] font-semibold tracking-[-0.005em]" />}
          {description && <AutoDir as="p" text={description} className="text-[12px] text-ink-3" />}
        </header>
      )}
      <div className={cn('min-h-0 flex-1', !bare && 'px-4 pt-2 pb-4')}>{children}</div>
    </Panel>
  );
}

const TONE_MAP = { neutral: 'neutral', positive: 'positive', warning: 'warning', negative: 'negative', info: 'info' } as const;

/** Kind badges the page header already shows ("Priority", "Main focus"…). */
const KIND_WORDS = /^(main( focus)?|priority|supporting|continuous|goal|idea|experiment|الأولوية|أولوية|داعم|مستمر|هدف|فكرة|تجربة)$/i;

export function HeroSection({ s }: { s: SectionOf<'hero'> }) {
  const { pageTitle } = usePageCtx();
  // The page header already shows the title and focus kind — don't repeat them.
  const title = s.title && s.title.trim().toLowerCase() !== pageTitle.trim().toLowerCase() ? s.title : null;
  const status = s.status && !KIND_WORDS.test(s.status.label.trim()) ? s.status : null;
  return (
    <div className="space-y-4 py-1">
      {(title || status) && (
        <div className="flex items-center gap-2">
          {title && <AutoDir as="h2" text={title} className="text-[15px] font-semibold" />}
          {status && (
            <Chip tone={TONE_MAP[status.tone ?? 'neutral']}>
              <bdi>{status.label}</bdi>
            </Chip>
          )}
        </div>
      )}
      <Markdown className="max-w-[72ch] text-[15px] leading-relaxed text-ink-2">{s.summary}</Markdown>
      {s.stats && s.stats.length > 0 && (
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          {s.stats.map((st) => (
            <div key={st.label}>
              <p className="num text-[24px] leading-none font-semibold tracking-[-0.02em]">{typeof st.value === 'number' ? formatNumber(st.value) : st.value}</p>
              <AutoDir as="p" text={st.label} className="mt-1.5 text-[12px] text-ink-3" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCell({ k }: { k: KpiItem }) {
  const { focusId } = usePageCtx();
  const { data, isLoading } = useAggregate(k.compute, focusId);
  const raw = k.value !== undefined ? k.value : data?.value;
  const value = typeof raw === 'number' || (typeof raw === 'string' && raw !== '' && !Number.isNaN(Number(raw))) ? formatNumber(raw, k.format, k.unit) : (raw ?? '—');
  const n = typeof raw === 'number' ? raw : Number(raw);
  return (
    <div className="flex min-w-0 flex-col gap-1.5 bg-surface px-4 py-3.5">
      <AutoDir as="p" text={k.label} className="truncate text-[12px] text-ink-3" />
      <p className={cn('num text-[26px] leading-none font-semibold tracking-[-0.025em]', isLoading && k.compute && 'text-ink-4')}>
        {isLoading && k.compute ? '·' : value}
        {k.target !== undefined && <span className="ms-1 text-[13px] font-normal text-ink-3">/ {formatNumber(k.target, k.format)}</span>}
      </p>
      {k.target !== undefined && Number.isFinite(n) && <ProgressBar value={n} max={k.target} tone={n >= k.target ? 'positive' : 'brand'} className="mt-1" />}
      {k.hint && <AutoDir as="p" text={k.hint} className="truncate text-[11.5px] text-ink-3" />}
    </div>
  );
}

export function KpisSection({ s }: { s: SectionOf<'kpis'> }) {
  return (
    <Panel className="overflow-hidden">
      {s.title && <AutoDir as="h2" text={s.title} className="block px-4 pt-3.5 pb-1 text-[13px] font-semibold" />}
      <div className={cn('grid gap-px bg-border', s.title && 'border-t border-border', s.items.length >= 4 ? 'grid-cols-2 md:grid-cols-4' : s.items.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2')}>
        {s.items.map((k) => (
          <KpiCell key={k.label} k={k} />
        ))}
        {s.items.length >= 4 && s.items.length % 4 !== 0 && Array.from({ length: 4 - (s.items.length % 4) }).map((_, i) => <div key={i} className="hidden bg-surface md:block" />)}
      </div>
    </Panel>
  );
}

function Spark({ metric, range, height = 44 }: { metric: string; range?: string; height?: number }) {
  const { data } = useMetric(metric, range);
  const option = useCallback(
    (t: ChartTheme) => ({
      grid: { left: 0, right: 0, top: 4, bottom: 2 },
      xAxis: { type: 'time', show: false },
      yAxis: { type: 'value', show: false, scale: true },
      tooltip: { trigger: 'axis', ...tooltipBase(t), valueFormatter: (v: number) => formatNumber(v) },
      series: [
        {
          type: 'line',
          data: (data?.points ?? []).map((p) => [p.t, p.v]),
          showSymbol: false,
          smooth: 0.25,
          lineStyle: { width: 2, color: t.series[0] },
          areaStyle: { color: t.series[0], opacity: 0.08 },
        },
      ],
    }),
    [data],
  );
  if (!data?.points.length) return <p className="text-[12px] text-ink-3">{t('No data yet')}</p>;
  return <EChart option={option} height={height} />;
}

export function MetricSection({ s }: { s: SectionOf<'metric'> }) {
  const { focusId } = usePageCtx();
  const { data } = useAggregate(s.compute, focusId);
  const raw = s.value !== undefined ? s.value : data?.value;
  return (
    <Frame title={s.title} description={s.description}>
      <AutoDir as="p" text={s.label} className="text-[12px] text-ink-3" />
      <p className="num mt-1 text-[30px] leading-none font-semibold tracking-[-0.025em]">
        {formatNumber(raw, s.format, s.unit)}
        {s.target !== undefined && <span className="ms-1 text-[14px] font-normal text-ink-3">/ {formatNumber(s.target, s.format)}</span>}
      </p>
      {s.trend && (
        <div className="mt-3">
          <Spark metric={s.trend} />
        </div>
      )}
    </Frame>
  );
}

export function SparklineSection({ s }: { s: SectionOf<'sparkline'> }) {
  const { data } = useMetric(s.metric, s.range);
  return (
    <Frame title={s.title} description={s.description}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <AutoDir as="p" text={s.label} className="text-[12px] text-ink-3" />
          <p className="num mt-1 text-[26px] leading-none font-semibold tracking-[-0.025em]">{formatNumber(data?.latest, s.format)}</p>
        </div>
        <div className="w-1/2 min-w-[120px]">
          <Spark metric={s.metric} range={s.range} />
        </div>
      </div>
    </Frame>
  );
}

function ProgressItemRow({ item }: { item: SectionOf<'progress'>['items'][number] }) {
  const { focusId } = usePageCtx();
  const { data } = useAggregate(item.compute, focusId);
  const current = item.current ?? data?.value ?? 0;
  const done = current >= item.target;
  return (
    <li className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <AutoDir text={item.label} className="truncate" />
        <span className="num shrink-0 text-ink-2" dir="ltr">
          {formatNumber(current)} / {formatNumber(item.target)}
          {item.unit ? ` ${item.unit}` : ''}
        </span>
      </div>
      <ProgressBar value={current} max={item.target} tone={done ? 'positive' : 'brand'} className="h-1.5" />
    </li>
  );
}

export function ProgressSection({ s }: { s: SectionOf<'progress'> }) {
  return (
    <Frame title={s.title} description={s.description}>
      <ul className="space-y-3.5">
        {s.items.map((i) => (
          <ProgressItemRow key={i.label} item={i} />
        ))}
      </ul>
    </Frame>
  );
}

export function MarkdownSection({ s }: { s: SectionOf<'markdown'> }) {
  return (
    <Frame title={s.title} description={s.description}>
      <Markdown className="text-[13.5px]">{s.content}</Markdown>
    </Frame>
  );
}
