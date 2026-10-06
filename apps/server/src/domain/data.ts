import type { Aggregate, DataResult, DataRow, DataSource, FieldDef, SeriesResult } from '@opervio/contracts';
import { db } from '../db';
import { searchMemory } from './memory';
import { queryRecords } from './records';

/**
 * Resolves any page data source into one tabular shape, so every registry component
 * (table, list, kanban, timeline, calendar, bar…) can render any source.
 */
const f = (key: string, label: string, type: FieldDef['type'], options?: string[]): FieldDef => ({ key, label, type, ...(options ? { options } : {}) });

const TASK_FIELDS = [
  f('title', 'Task', 'text'),
  f('status', 'Status', 'status', ['queued', 'running', 'waiting', 'done', 'failed', 'cancelled']),
  f('agent', 'Agent', 'person'),
  f('taskType', 'Type', 'text'),
  f('updatedAt', 'Updated', 'datetime'),
];

const scopeWhere = (focusId: string | null | undefined, scope?: 'focus' | 'all') => (scope === 'all' || !focusId ? {} : { focusId });

export async function resolveSource(source: DataSource, focusId?: string | null): Promise<DataResult> {
  switch (source.kind) {
    case 'records': {
      const res = await queryRecords(source.collection, { where: source.where, sort: source.sort, limit: source.limit });
      if (!res) return { fields: [], rows: [], titleField: 'title', missing: `No data yet for "${source.collection}"` };
      return {
        fields: res.def.fields,
        rows: res.rows.map((r) => ({ ...(r.data as object), id: r.id, _kind: 'record', _updatedAt: r.updatedAt.toISOString() }) as DataRow),
        titleField: res.def.titleField,
        statusField: res.def.statusField,
        dateField: res.def.dateField,
        collection: res.def,
      };
    }
    case 'tasks': {
      const tasks = await db.task.findMany({
        where: { ...scopeWhere(focusId, source.scope), ...(source.status ? { status: { in: source.status } } : {}) },
        include: { agent: true },
        orderBy: { updatedAt: 'desc' },
        take: source.limit ?? 50,
      });
      return {
        fields: TASK_FIELDS,
        rows: tasks.map((t) => ({ id: t.id, _kind: 'task', title: t.title, status: t.status, agent: t.agent.name, taskType: t.taskType, updatedAt: t.updatedAt.toISOString() })),
        titleField: 'title',
        statusField: 'status',
        dateField: 'updatedAt',
      };
    }
    case 'agents': {
      const agents = await db.agent.findMany({ where: scopeWhere(focusId, source.scope), orderBy: { updatedAt: 'desc' } });
      return {
        fields: [f('name', 'Name', 'text'), f('role', 'Role', 'text'), f('status', 'Status', 'status', ['idle', 'working', 'waiting', 'done', 'failed', 'stopped']), f('effort', 'Effort', 'text')],
        rows: agents.map((a) => ({ id: a.id, _kind: 'agent', name: a.name, role: a.role, status: a.status, effort: a.effort })),
        titleField: 'name',
        statusField: 'status',
      };
    }
    case 'outputs': {
      const items = await db.artifact.findMany({
        where: { ...scopeWhere(focusId, source.scope), ...(source.types ? { type: { in: source.types } } : {}) },
        include: { agent: true },
        orderBy: { createdAt: 'desc' },
        take: source.limit ?? 50,
      });
      return {
        fields: [f('title', 'Output', 'text'), f('type', 'Type', 'text'), f('agent', 'By', 'person'), f('createdAt', 'Created', 'datetime')],
        rows: items.map((a) => ({ id: a.id, _kind: 'output', title: a.title, type: a.type, agent: a.agent?.name ?? '', createdAt: a.createdAt.toISOString() })),
        titleField: 'title',
        dateField: 'createdAt',
      };
    }
    case 'decisions': {
      const items = await db.decision.findMany({ where: { ...scopeWhere(focusId, source.scope), status: 'open', kind: { not: 'plan' } }, orderBy: { createdAt: 'desc' } });
      return {
        fields: [f('title', 'Decision', 'text'), f('recommendation', 'Recommendation', 'longtext'), f('createdAt', 'Asked', 'datetime')],
        rows: items.map((d) => ({ id: d.id, _kind: 'decision', title: d.title, recommendation: d.recommendation ?? '', createdAt: d.createdAt.toISOString() })),
        titleField: 'title',
        dateField: 'createdAt',
      };
    }
    case 'memories': {
      const fields = [f('content', 'Memory', 'longtext'), f('kind', 'Kind', 'text'), f('createdAt', 'Saved', 'datetime')];
      const items = source.query
        ? (await searchMemory(source.query, { focusId, limit: source.limit ?? 20 })).map((m) => ({ ...m, createdAt: new Date(m.createdAt) }))
        : await db.memory.findMany({ where: scopeWhere(focusId, source.scope), orderBy: { createdAt: 'desc' }, take: source.limit ?? 20 });
      return {
        fields,
        rows: items.map((m) => ({ id: m.id, _kind: 'memory', content: m.content, kind: m.kind, createdAt: m.createdAt.toISOString() })),
        titleField: 'content',
        dateField: 'createdAt',
      };
    }
    case 'metric': {
      const series = await metricSeries(source.key, source.range);
      return {
        fields: [f('t', 'Date', 'datetime'), f('v', 'Value', 'number')],
        rows: series.points.map((p, i) => ({ id: String(i), _kind: 'metric', t: p.t, v: p.v })),
        titleField: 't',
        dateField: 't',
      };
    }
    case 'activity': {
      const events = await db.runEvent.findMany({
        where: { kind: { in: ['progress', 'file', 'judge', 'status'] }, run: { task: scopeWhere(focusId, source.scope) } },
        include: { run: { include: { agent: true } } },
        orderBy: { ts: 'desc' },
        take: source.limit ?? 20,
      });
      return {
        fields: [f('label', 'Activity', 'text'), f('agent', 'Agent', 'person'), f('ts', 'When', 'datetime')],
        rows: events.map((e) => ({ id: e.id, _kind: 'activity', label: e.label, agent: e.run.agent.name, agentId: e.run.agentId, ts: e.ts.toISOString() })),
        titleField: 'label',
        dateField: 'ts',
      };
    }
  }
}

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90, all: 3650 } as const;

export async function metricSeries(key: string, range: keyof typeof RANGE_DAYS = '30d'): Promise<SeriesResult> {
  const since = new Date(Date.now() - RANGE_DAYS[range] * 86400_000);
  const points = await db.metricPoint.findMany({ where: { key, ts: { gte: since } }, orderBy: { ts: 'asc' } });
  return { points: points.map((p) => ({ t: p.ts.toISOString(), v: p.value })), latest: points.at(-1)?.value ?? null };
}

export async function aggregate(agg: Aggregate, focusId?: string | null): Promise<number | null> {
  if (agg.source.kind === 'metric') {
    const s = await metricSeries(agg.source.key, agg.source.range);
    const vals = s.points.map((p) => p.v);
    return reduce(vals, agg.op === 'count' ? 'count' : agg.op);
  }
  const data = await resolveSource({ ...agg.source, ...('limit' in agg.source ? { limit: 500 } : {}) } as DataSource, focusId);
  if (agg.op === 'count') return data.rows.length;
  const field = agg.field;
  if (!field) return null;
  const vals = data.rows.map((r) => Number(r[field])).filter((n) => Number.isFinite(n));
  return reduce(vals, agg.op);
}

function reduce(vals: number[], op: Aggregate['op']): number | null {
  if (op === 'count') return vals.length;
  if (!vals.length) return null;
  switch (op) {
    case 'sum':
      return vals.reduce((a, b) => a + b, 0);
    case 'avg':
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    case 'min':
      return Math.min(...vals);
    case 'max':
      return Math.max(...vals);
    case 'latest':
      return vals.at(-1) ?? null;
  }
}

export async function logMetric(key: string, value: number, opts: { note?: string; focusId?: string | null } = {}) {
  return db.metricPoint.create({ data: { key, value, note: opts.note ?? null, focusId: opts.focusId ?? null } });
}
