import { BarChart, FunnelChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';
import { useEffect, useMemo, useRef } from 'react';
import { useIsDark } from '@/hooks/use-theme';

echarts.use([LineChart, BarChart, FunnelChart, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

export interface ChartTheme {
  series: [string, string, string];
  ink: string;
  ink2: string;
  ink3: string;
  grid: string;
  surface: string;
  border: string;
  font: string;
  /** Ordinal ramp (light→dark) for funnels/stages, clear of the surface in both modes. */
  ramp: string[];
}

const read = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function chartTheme(dark: boolean): ChartTheme {
  return {
    series: [read('--series-1'), read('--series-2'), read('--series-3')],
    ink: read('--foreground'),
    ink2: read('--ink-2'),
    ink3: read('--ink-3'),
    grid: read('--grid'),
    surface: read('--surface'),
    border: read('--border'),
    font: 'Geist Variable, IBM Plex Sans Arabic, system-ui, sans-serif',
    ramp: dark
      ? ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef']
      : ['#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95'],
  };
}

/** Shared tooltip look: surface card, text in ink tokens (never series color). */
export const tooltipBase = (t: ChartTheme) => ({
  backgroundColor: t.surface,
  borderColor: t.border,
  borderWidth: 1,
  padding: [6, 10],
  textStyle: { color: t.ink, fontFamily: t.font, fontSize: 12 },
  extraCssText: 'border-radius:8px;box-shadow:0 8px 24px -10px rgba(0,0,0,.25);',
});

export const axisBase = (t: ChartTheme) => ({
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: t.ink3, fontFamily: t.font, fontSize: 11 },
  splitLine: { lineStyle: { color: t.grid, width: 1 } },
});

export function EChart({ option, height, className }: { option: (t: ChartTheme) => EChartsCoreOption; height: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const dark = useIsDark();
  const theme = useMemo(() => chartTheme(dark), [dark]);

  useEffect(() => {
    if (!ref.current) return;
    chart.current = echarts.init(ref.current, null, { renderer: 'svg' });
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption({ animationDuration: 400, textStyle: { fontFamily: theme.font }, ...option(theme) }, true);
  }, [option, theme]);

  return <div ref={ref} className={className} style={{ height, width: '100%' }} />;
}
