import { endSide, t } from '@/lib/i18n';
import type { LeafSection, PageDTO, Section } from '@opervio/contracts';
import { Component, type ReactNode } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { AutoDir } from '../app/primitives';
import { PageProvider, usePageCtx } from './context';
import { FieldValue } from './field-value';
import { fieldLabel } from './sections-shared';
import { HeroSection, KpisSection, MarkdownSection, MetricSection, ProgressSection, SparklineSection } from './sections-basic';
import { BarSection, FunnelSection, LineSection } from './sections-charts';
import { CalendarSection, FiltersSection, KanbanSection, ListSection, TableSection, TimelineSection } from './sections-collections';
import { ActivitySection, AgentsSection, DecisionsSection, OutputsSection } from './sections-live';

/** The renderer owns layout. Widths map onto a 6-column bento grid; nothing else is configurable. */
const WIDTH: Record<string, string> = {
  full: 'md:col-span-6',
  'two-thirds': 'md:col-span-6 xl:col-span-4',
  half: 'md:col-span-3',
  third: 'md:col-span-3 xl:col-span-2',
};

const DEFAULT_WIDTH: Partial<Record<Section['type'], keyof typeof WIDTH>> = {
  hero: 'full',
  kpis: 'full',
  filters: 'full',
  tabs: 'full',
  kanban: 'full',
  table: 'full',
  calendar: 'full',
  metric: 'third',
  sparkline: 'third',
  agents: 'half',
  activity: 'half',
  decisions: 'half',
};

function LeafRenderer({ s }: { s: LeafSection }) {
  switch (s.type) {
    case 'hero':
      return <HeroSection s={s} />;
    case 'kpis':
      return <KpisSection s={s} />;
    case 'metric':
      return <MetricSection s={s} />;
    case 'sparkline':
      return <SparklineSection s={s} />;
    case 'line':
      return <LineSection s={s} />;
    case 'bar':
      return <BarSection s={s} />;
    case 'funnel':
      return <FunnelSection s={s} />;
    case 'progress':
      return <ProgressSection s={s} />;
    case 'table':
      return <TableSection s={s} />;
    case 'kanban':
      return <KanbanSection s={s} />;
    case 'timeline':
      return <TimelineSection s={s} />;
    case 'calendar':
      return <CalendarSection s={s} />;
    case 'list':
      return <ListSection s={s} />;
    case 'agents':
      return <AgentsSection s={s} />;
    case 'activity':
      return <ActivitySection s={s} />;
    case 'decisions':
      return <DecisionsSection s={s} />;
    case 'outputs':
      return <OutputsSection s={s} />;
    case 'markdown':
      return <MarkdownSection s={s} />;
    case 'filters':
      return <FiltersSection s={s} />;
  }
}

/** One broken section never takes the page down. */
class SectionBoundary extends Component<{ children: ReactNode; label: string }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }
  render() {
    if (this.state.error) return <div className="rounded-xl border border-dashed border-border p-4 text-[12.5px] text-ink-3">{t('This {type} section couldn’t render.', { type: this.props.label })}</div>;
    return this.props.children;
  }
}

export function SectionGrid({ sections }: { sections: Section[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
      {sections.map((s, i) => (
        <div key={s.id ?? i} className={cn('min-w-0', WIDTH[s.width ?? DEFAULT_WIDTH[s.type] ?? 'full'])}>
          <SectionBoundary label={s.type}>
            {s.type === 'tabs' ? (
              <Tabs defaultValue="0" className="gap-3">
                <TabsList>
                  {s.tabs.map((t, ti) => (
                    <TabsTrigger key={ti} value={String(ti)}>
                      <AutoDir text={t.label} />
                    </TabsTrigger>
                  ))}
                </TabsList>
                {s.tabs.map((t, ti) => (
                  <TabsContent key={ti} value={String(ti)}>
                    <SectionGrid sections={t.sections} />
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <LeafRenderer s={s} />
            )}
          </SectionBoundary>
        </div>
      ))}
    </div>
  );
}

function RecordDrawer() {
  const { record, closeRecord } = usePageCtx();
  return (
    <Sheet open={Boolean(record)} onOpenChange={(o) => !o && closeRecord()}>
      <SheetContent side={endSide()} resizable={{ id: 'record', defaultWidth: 520 }} className="w-full gap-0 bg-surface p-0 sm:max-w-[520px]">
        {record && (
          <>
            <SheetHeader className="px-5 pt-5 pb-3">
              <SheetTitle className="pe-8 text-[16px] font-semibold">
                <AutoDir text={String(record.row[record.titleField] ?? t('Record'))} />
              </SheetTitle>
              <SheetDescription className="text-[12px]">{t('Details')}</SheetDescription>
            </SheetHeader>
            <dl className="min-h-0 flex-1 divide-y divide-border overflow-y-auto border-t border-border">
              {record.fields
                .filter((f) => f.key !== record.titleField)
                .map((f) => (
                  <div key={f.key} className={cn('grid gap-1 px-5 py-3', f.type === 'longtext' ? 'grid-cols-1' : 'grid-cols-[140px_1fr] items-start')}>
                    <dt className="text-[12px] text-ink-3">
                      <bdi>{fieldLabel(f, f.key)}</bdi>
                    </dt>
                    <dd className="min-w-0 text-[13px]">
                      <FieldValue field={f} value={record.row[f.key]} full />
                    </dd>
                  </div>
                ))}
            </dl>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function PageRenderer({ page }: { page: PageDTO }) {
  return (
    <PageProvider focusId={page.focus?.id ?? null} pageTitle={page.title}>
      <SectionGrid sections={page.spec.sections} />
      <RecordDrawer />
    </PageProvider>
  );
}
