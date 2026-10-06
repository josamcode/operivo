import { z } from 'zod';
import { ArtifactType, CollectionKey, FieldKey, MetricKey, TaskStatus } from './common';

/**
 * The UI grammar. The AI composes pages from these primitives; the renderer owns
 * every visual decision. Objects are strict so arbitrary props (style, className,
 * html, …) are rejected instead of silently ignored.
 */

export const PAGE_ICONS = [
  'briefcase',
  'users',
  'megaphone',
  'video',
  'pen-line',
  'book-open',
  'graduation-cap',
  'dumbbell',
  'heart-pulse',
  'code',
  'terminal',
  'flask',
  'chart',
  'wallet',
  'target',
  'calendar',
  'folder',
  'rocket',
  'lightbulb',
  'globe',
  'house',
  'music',
  'camera',
  'plane',
  'shopping-bag',
  'building',
  'mic',
  'newspaper',
  'brain',
  'compass',
  'layers',
  'package',
  'palette',
  'scale',
  'shield',
  'timer',
  'trophy',
  'user',
  'zap',
  'sprout',
  'utensils',
  'moon',
] as const;
export const PageIcon = z.enum(PAGE_ICONS);
export type PageIcon = z.infer<typeof PageIcon>;

const Limit = z.number().int().min(1).max(500).optional();
const Scope = z.enum(['focus', 'all']).optional();

const WhereValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string()).max(20)]);
export const Where = z.record(FieldKey, WhereValue);
export type Where = z.infer<typeof Where>;

export const DataSource = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('records'),
    collection: CollectionKey,
    where: Where.optional(),
    sort: z.strictObject({ field: FieldKey, dir: z.enum(['asc', 'desc']).optional() }).optional(),
    limit: Limit,
  }),
  z.strictObject({ kind: z.literal('tasks'), status: z.array(TaskStatus).optional(), scope: Scope, limit: Limit }),
  z.strictObject({ kind: z.literal('agents'), scope: Scope }),
  z.strictObject({ kind: z.literal('outputs'), types: z.array(ArtifactType).optional(), scope: Scope, limit: Limit }),
  z.strictObject({ kind: z.literal('decisions'), scope: Scope }),
  z.strictObject({ kind: z.literal('memories'), query: z.string().max(200).optional(), scope: Scope, limit: Limit }),
  z.strictObject({ kind: z.literal('metric'), key: MetricKey, range: z.enum(['7d', '30d', '90d', 'all']).optional() }),
  z.strictObject({ kind: z.literal('activity'), scope: Scope, limit: Limit }),
]);
export type DataSource = z.infer<typeof DataSource>;
export type DataSourceKind = DataSource['kind'];

/** A computed number: count/sum/avg over a data source. */
export const Aggregate = z.strictObject({
  source: DataSource,
  op: z.enum(['count', 'sum', 'avg', 'min', 'max', 'latest']),
  field: FieldKey.optional(),
});
export type Aggregate = z.infer<typeof Aggregate>;

const NumberFormat = z.enum(['number', 'percent', 'currency', 'duration']);
const Tone = z.enum(['neutral', 'positive', 'warning', 'negative', 'info']);

const Width = z.enum(['full', 'two-thirds', 'half', 'third']);
const base = {
  id: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
  title: z.string().max(80).optional(),
  description: z.string().max(200).optional(),
  width: Width.optional(),
};

const Value = z.union([z.string().max(40), z.number()]);

export const KpiItem = z
  .strictObject({
    label: z.string().min(1).max(40),
    value: Value.optional(),
    compute: Aggregate.optional(),
    target: z.number().optional(),
    format: NumberFormat.optional(),
    unit: z.string().max(12).optional(),
    hint: z.string().max(80).optional(),
    tone: Tone.optional(),
  })
  .refine((k) => k.value !== undefined || k.compute !== undefined, {
    message: 'a KPI needs either a static "value" or a "compute" aggregate',
  });
export type KpiItem = z.infer<typeof KpiItem>;

const Column = z.strictObject({ field: FieldKey, label: z.string().max(40).optional() });

const HeroSection = z.strictObject({
  ...base,
  type: z.literal('hero'),
  summary: z.string().max(500),
  stats: z.array(z.strictObject({ label: z.string().max(30), value: Value })).max(4).optional(),
  status: z.strictObject({ label: z.string().max(30), tone: Tone.optional() }).optional(),
});

const KpisSection = z.strictObject({ ...base, type: z.literal('kpis'), items: z.array(KpiItem).min(1).max(6) });

const MetricSection = z.strictObject({
  ...base,
  type: z.literal('metric'),
  label: z.string().max(40),
  value: Value.optional(),
  compute: Aggregate.optional(),
  target: z.number().optional(),
  format: NumberFormat.optional(),
  unit: z.string().max(12).optional(),
  trend: MetricKey.optional(),
});

const SparklineSection = z.strictObject({
  ...base,
  type: z.literal('sparkline'),
  label: z.string().max(40),
  metric: MetricKey,
  range: z.enum(['7d', '30d', '90d', 'all']).optional(),
  format: NumberFormat.optional(),
});

const LineSection = z.strictObject({
  ...base,
  type: z.literal('line'),
  source: DataSource,
  x: FieldKey.optional(),
  y: FieldKey.optional(),
  format: NumberFormat.optional(),
});

const BarSection = z.strictObject({
  ...base,
  type: z.literal('bar'),
  source: DataSource,
  groupBy: FieldKey,
  op: z.enum(['count', 'sum', 'avg']).optional(),
  field: FieldKey.optional(),
  orientation: z.enum(['vertical', 'horizontal']).optional(),
});

const FunnelSection = z.strictObject({
  ...base,
  type: z.literal('funnel'),
  source: DataSource,
  field: FieldKey,
  stages: z.array(z.string().max(40)).min(2).max(8),
  cumulative: z.boolean().optional(),
});

const ProgressItem = z
  .strictObject({
    label: z.string().max(40),
    current: z.number().optional(),
    compute: Aggregate.optional(),
    target: z.number().positive(),
    unit: z.string().max(12).optional(),
  })
  .refine((p) => p.current !== undefined || p.compute !== undefined, {
    message: 'a progress item needs "current" or "compute"',
  });

const ProgressSection = z.strictObject({ ...base, type: z.literal('progress'), items: z.array(ProgressItem).min(1).max(8) });

const TableSection = z.strictObject({
  ...base,
  type: z.literal('table'),
  source: DataSource,
  columns: z.array(Column).max(12).optional(),
  filterable: z.array(FieldKey).max(4).optional(),
  searchable: z.boolean().optional(),
  pageSize: z.number().int().min(5).max(100).optional(),
});

const KanbanSection = z.strictObject({
  ...base,
  type: z.literal('kanban'),
  source: DataSource,
  groupBy: FieldKey,
  columns: z.array(z.string().max(40)).max(10).optional(),
  cardTitle: FieldKey.optional(),
  cardFields: z.array(FieldKey).max(4).optional(),
});

const TimelineSection = z.strictObject({
  ...base,
  type: z.literal('timeline'),
  source: DataSource,
  dateField: FieldKey.optional(),
  titleField: FieldKey.optional(),
  limit: Limit,
});

const CalendarSection = z.strictObject({
  ...base,
  type: z.literal('calendar'),
  source: DataSource,
  dateField: FieldKey.optional(),
  titleField: FieldKey.optional(),
  view: z.enum(['week', 'month']).optional(),
});

const ListSection = z.strictObject({
  ...base,
  type: z.literal('list'),
  source: DataSource,
  titleField: FieldKey.optional(),
  subtitleField: FieldKey.optional(),
  metaField: FieldKey.optional(),
  checkField: FieldKey.optional(),
  limit: Limit,
});

const AgentsSection = z.strictObject({ ...base, type: z.literal('agents'), scope: Scope });
const ActivitySection = z.strictObject({ ...base, type: z.literal('activity'), scope: Scope, limit: Limit });
const DecisionsSection = z.strictObject({ ...base, type: z.literal('decisions'), scope: Scope });
const OutputsSection = z.strictObject({
  ...base,
  type: z.literal('outputs'),
  types: z.array(ArtifactType).optional(),
  scope: Scope,
  limit: Limit,
  layout: z.enum(['grid', 'list']).optional(),
});
const MarkdownSection = z.strictObject({ ...base, type: z.literal('markdown'), content: z.string().max(8000) });
const FiltersSection = z.strictObject({
  ...base,
  type: z.literal('filters'),
  collection: CollectionKey,
  fields: z.array(FieldKey).min(1).max(4),
});

const leafSections = [
  HeroSection,
  KpisSection,
  MetricSection,
  SparklineSection,
  LineSection,
  BarSection,
  FunnelSection,
  ProgressSection,
  TableSection,
  KanbanSection,
  TimelineSection,
  CalendarSection,
  ListSection,
  AgentsSection,
  ActivitySection,
  DecisionsSection,
  OutputsSection,
  MarkdownSection,
  FiltersSection,
] as const;

export const LeafSection = z.discriminatedUnion('type', leafSections);
export type LeafSection = z.infer<typeof LeafSection>;

const TabsSection = z.strictObject({
  ...base,
  type: z.literal('tabs'),
  tabs: z
    .array(z.strictObject({ label: z.string().min(1).max(30), sections: z.array(LeafSection).min(1).max(12) }))
    .min(2)
    .max(6),
});

export const Section = z.discriminatedUnion('type', [...leafSections, TabsSection]);
export type Section = z.infer<typeof Section>;
export type SectionType = Section['type'];
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;

export const SECTION_TYPES = Section.options.map((o) => o.shape.type.value) as SectionType[];

export const PageSpec = z.strictObject({
  title: z.string().min(1).max(40),
  icon: PageIcon,
  description: z.string().max(160).optional(),
  sections: z.array(Section).max(24),
});
export type PageSpec = z.infer<typeof PageSpec>;

export const PageOp = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('rename'), title: z.string().min(1).max(40) }),
  z.strictObject({ op: z.literal('set_icon'), icon: PageIcon }),
  z.strictObject({ op: z.literal('set_description'), description: z.string().max(160) }),
  z.strictObject({ op: z.literal('add_section'), section: Section, index: z.number().int().min(0).optional() }),
  z.strictObject({ op: z.literal('remove_section'), id: z.string() }),
  z.strictObject({ op: z.literal('move_section'), id: z.string(), index: z.number().int().min(0) }),
  z.strictObject({ op: z.literal('update_section'), id: z.string(), patch: z.record(z.string(), z.unknown()) }),
  z.strictObject({ op: z.literal('replace_sections'), sections: z.array(Section).max(24) }),
]);
export type PageOp = z.infer<typeof PageOp>;

/** Gives every section (including sections inside tabs) a stable, unique id. */
export function withSectionIds(spec: PageSpec): PageSpec {
  const used = new Set<string>();
  const assign = <S extends { id?: string; type: string }>(s: S): S => {
    let id = s.id && !used.has(s.id) ? s.id : '';
    if (!id) {
      let n = 1;
      while (used.has(`${s.type}-${n}`)) n++;
      id = `${s.type}-${n}`;
    }
    used.add(id);
    return { ...s, id };
  };
  return {
    ...spec,
    sections: spec.sections.map((s) => {
      const withId = assign(s);
      if (withId.type === 'tabs') {
        return { ...withId, tabs: withId.tabs.map((t) => ({ ...t, sections: t.sections.map(assign) })) };
      }
      return withId;
    }),
  };
}

export class PageOpError extends Error {}

/** Applies validated ops and re-validates the whole page. Throws with an AI-readable message. */
export function applyPageOps(spec: PageSpec, ops: PageOp[]): PageSpec {
  let next: PageSpec = withSectionIds(JSON.parse(JSON.stringify(spec)) as PageSpec);
  for (const op of ops) {
    const idx = (id: string) => {
      const i = next.sections.findIndex((s) => s.id === id);
      if (i < 0) throw new PageOpError(`No section with id "${id}". Existing: ${next.sections.map((s) => s.id).join(', ')}`);
      return i;
    };
    switch (op.op) {
      case 'rename':
        next.title = op.title;
        break;
      case 'set_icon':
        next.icon = op.icon;
        break;
      case 'set_description':
        next.description = op.description;
        break;
      case 'add_section': {
        const at = op.index ?? next.sections.length;
        next.sections.splice(Math.min(at, next.sections.length), 0, op.section);
        break;
      }
      case 'remove_section':
        next.sections.splice(idx(op.id), 1);
        break;
      case 'move_section': {
        const [s] = next.sections.splice(idx(op.id), 1);
        next.sections.splice(Math.min(op.index, next.sections.length), 0, s);
        break;
      }
      case 'update_section': {
        const i = idx(op.id);
        const merged = { ...next.sections[i], ...op.patch, id: op.id };
        const parsed = Section.safeParse(merged);
        if (!parsed.success) throw new PageOpError(formatZodError(parsed.error, `section "${op.id}"`));
        next.sections[i] = parsed.data;
        break;
      }
      case 'replace_sections':
        next.sections = op.sections;
        break;
    }
    next = withSectionIds(next);
  }
  const parsed = PageSpec.safeParse(next);
  if (!parsed.success) throw new PageOpError(formatZodError(parsed.error, 'page'));
  return parsed.data;
}

export function formatZodError(error: z.ZodError, subject = 'input'): string {
  const lines = error.issues.slice(0, 8).map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`);
  return `Invalid ${subject}:\n${lines.join('\n')}`;
}

/** Collections referenced by a page — used to warn the AI about missing collection definitions. */
export function collectionsUsed(spec: PageSpec): string[] {
  const out = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const v = value as Record<string, unknown>;
    if (v.kind === 'records' && typeof v.collection === 'string') out.add(v.collection);
    if (v.type === 'filters' && typeof v.collection === 'string') out.add(v.collection);
    for (const child of Object.values(v)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  spec.sections.forEach(visit);
  return [...out];
}
