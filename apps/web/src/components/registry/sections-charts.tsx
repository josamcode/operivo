import type { DataRow, SectionOf } from '@opervio/contracts';
import { useCallback, useMemo } from 'react';
import { formatNumber } from '@/lib/format';
import { useData } from '@/lib/queries';
import { axisBase, chartTheme, EChart, tooltipBase, type ChartTheme } from '../app/chart';
import { AutoDir } from '../app/primitives';
import { useIsDark } from '@/hooks/use-theme';
import { useFiltered, usePageCtx } from './context';
import { Frame } from './sections-basic';
import { Empty, collectionOf } from './sections-shared';

const day = (v: unknown) => {
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export function LineSection({ s }: { s: SectionOf<'line'> }) {
  const { focusId } = usePageCtx();
  const { data } = useData(s.source, focusId);
  const rows = useFiltered(data?.rows ?? [], collectionOf(s.source));
  const points = useMemo(() => {
    if (!data) return [];
    if (s.source.kind === 'metric') return rows.map((r) => [String(r.t), Number(r.v)] as [string, number]);
    const xField = s.x ?? data.dateField ?? '_updatedAt';
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const d = day(r[xField]);
      if (!d) continue;
      const add = s.y ? Number(r[s.y]) || 0 : 1;
      byDay.set(d, (byDay.get(d) ?? 0) + add);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, rows, s.source.kind, s.x, s.y]);

  const option = useCallback(
    (t: ChartTheme) => ({
      grid: { left: 4, right: 8, top: 10, bottom: 4, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.ink3, width: 1 } }, ...tooltipBase(t), valueFormatter: (v: number) => formatNumber(v, s.format) },
      xAxis: { type: 'time', ...axisBase(t), splitLine: { show: false } },
      yAxis: { type: 'value', ...axisBase(t), axisLabel: { ...axisBase(t).axisLabel, formatter: (v: number) => formatNumber(v, s.format) } },
      series: [
        {
          type: 'line',
          name: s.title ?? 'Value',
          data: points,
          showSymbol: points.length < 20,
          symbolSize: 8,
          itemStyle: { color: t.series[0], borderColor: t.surface, borderWidth: 2 },
          lineStyle: { width: 2, color: t.series[0] },
          areaStyle: { color: t.series[0], opacity: 0.07 },
        },
      ],
    }),
    [points, s.format, s.title],
  );
  return (
    <Frame title={s.title} description={s.description}>
      {points.length === 0 ? <Empty text={data?.missing ?? 'No data points yet.'} /> : <EChart option={option} height={220} />}
    </Frame>
  );
}

function groupRows(rows: DataRow[], groupBy: string, op: 'count' | 'sum' | 'avg', field?: string) {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    const raw = r[groupBy];
    const keys = Array.isArray(raw) ? raw.map(String) : [raw === null || raw === undefined || raw === '' ? '—' : String(raw)];
    for (const k of keys) {
      const list = groups.get(k) ?? [];
      list.push(field ? Number(r[field]) || 0 : 1);
      groups.set(k, list);
    }
  }
  return [...groups.entries()].map(([k, v]) => ({ key: k, value: op === 'count' ? v.length : op === 'sum' ? v.reduce((a, b) => a + b, 0) : v.reduce((a, b) => a + b, 0) / v.length }));
}

export function BarSection({ s }: { s: SectionOf<'bar'> }) {
  const { focusId } = usePageCtx();
  const { data } = useData(s.source, focusId);
  const rows = useFiltered(data?.rows ?? [], collectionOf(s.source));
  const groups = useMemo(() => {
    const options = data?.fields.find((f) => f.key === s.groupBy)?.options;
    const g = groupRows(rows, s.groupBy, s.op ?? 'count', s.field);
    return options ? g.sort((a, b) => options.indexOf(a.key) - options.indexOf(b.key)) : g.sort((a, b) => b.value - a.value).slice(0, 12);
  }, [rows, data, s.groupBy, s.op, s.field]);
  const horizontal = s.orientation === 'horizontal' || (s.orientation !== 'vertical' && (groups.length > 6 || groups.some((g) => g.key.length > 12)));

  const option = useCallback(
    (t: ChartTheme) => {
      const cat = { type: 'category', data: groups.map((g) => g.key), ...axisBase(t), splitLine: { show: false } };
      const val = { type: 'value', minInterval: 1, ...axisBase(t) };
      return {
        grid: { left: 4, right: horizontal ? 32 : 8, top: 12, bottom: 4, containLabel: true },
        tooltip: { trigger: 'item', ...tooltipBase(t), valueFormatter: (v: number) => formatNumber(v) },
        xAxis: horizontal ? val : cat,
        yAxis: horizontal ? { ...cat, inverse: true } : val,
        series: [
          {
            type: 'bar',
            data: groups.map((g) => g.value),
            barMaxWidth: 22,
            itemStyle: { color: t.series[0], borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
            label: { show: groups.length <= 12, position: horizontal ? 'right' : 'top', color: t.ink2, fontSize: 11, formatter: ({ value }: { value: number }) => formatNumber(value) },
          },
        ],
      };
    },
    [groups, horizontal],
  );
  return (
    <Frame title={s.title} description={s.description}>
      {groups.length === 0 ? <Empty text={data?.missing ?? 'Nothing to chart yet.'} /> : <EChart option={option} height={horizontal ? Math.max(160, groups.length * 30 + 30) : 220} />}
    </Frame>
  );
}

/** Stage bars read better than funnel trapezoids: exact counts and step conversion, ordinal blue ramp. */
export function FunnelSection({ s }: { s: SectionOf<'funnel'> }) {
  const { focusId } = usePageCtx();
  const dark = useIsDark();
  const ramp = chartTheme(dark).ramp;
  const { data } = useData(s.source, focusId);
  const rows = useFiltered(data?.rows ?? [], collectionOf(s.source));
  const counts = useMemo(() => {
    const raw = s.stages.map((st) => rows.filter((r) => String(r[s.field] ?? '').toLowerCase() === st.toLowerCase()).length);
    // Cumulative: everyone who reached stage i also passed the stages before it.
    return s.cumulative === false ? raw : raw.map((_, i) => raw.slice(i).reduce((a, b) => a + b, 0));
  }, [rows, s.stages, s.field, s.cumulative]);
  const max = Math.max(1, ...counts);
  const step = Math.max(1, Math.floor(ramp.length / s.stages.length));
  return (
    <Frame title={s.title} description={s.description}>
      {rows.length === 0 ? (
        <Empty text={data?.missing ?? 'No items in this pipeline yet.'} />
      ) : (
        <ol className="space-y-2.5">
          {s.stages.map((st, i) => (
            <li key={st} className="grid grid-cols-[minmax(80px,140px)_1fr_auto] items-center gap-3 text-[12.5px]">
              <AutoDir text={st} className="truncate text-ink-2" />
              <div className="h-5 rounded-[4px] bg-muted">
                <div className="h-full rounded-[4px] transition-[width] duration-500" style={{ width: `${(counts[i] / max) * 100}%`, background: ramp[Math.min(ramp.length - 1, i * step)] }} />
              </div>
              <span className="num w-16 text-end">
                <span className="font-medium">{counts[i]}</span>
                {i > 0 && counts[i - 1] > 0 && <span className="ms-1.5 text-ink-3">{Math.round((counts[i] / counts[i - 1]) * 100)}%</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Frame>
  );
}
