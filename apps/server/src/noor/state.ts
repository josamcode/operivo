import { CollectionDef, PageSpec, type JudgeVerdict, type RunProgress } from '@opervio/contracts';
import { db } from '../db';
import { getFounder } from '../domain/founder';
import { getToday } from '../domain/today';
import { clip } from '../lib/text';
import { localDate, localTime } from '../lib/time';

/** Compact, current snapshot for Noor — enough to reason, never the whole database. */
export async function noorState({ detailed = false } = {}): Promise<string> {
  const founder = await getFounder();
  if (!founder) return 'Setup not complete.';
  const [focuses, collections, agents, tasks, decisions, today, outputs, routines] = await Promise.all([
    db.focus.findMany({ orderBy: { order: 'asc' }, include: { page: true } }),
    db.collection.findMany({ include: { _count: { select: { records: true } } } }),
    db.agent.findMany({
      where: { OR: [{ status: { in: ['working', 'waiting', 'idle'] } }, { updatedAt: { gte: new Date(Date.now() - 3 * 86400_000) } }] },
      include: { focus: true, tasks: { orderBy: { createdAt: 'desc' }, take: 1 }, runs: { orderBy: { startedAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    }),
    db.task.findMany({ orderBy: { updatedAt: 'desc' }, take: 10, include: { agent: true } }),
    db.decision.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'desc' }, take: 8 }),
    getToday(),
    db.artifact.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { agent: true } }),
    db.routine.findMany({ where: { enabled: true }, take: 10 }),
  ]);

  const lines: string[] = [];
  lines.push(`Now: ${localTime(founder.timezone)} · ${localDate(founder.timezone)} (${founder.timezone})`);
  lines.push(`\nFocuses${focuses.length ? '' : ': none yet — the founder has not confirmed a structure'}`);
  for (const f of focuses) {
    let pageInfo = 'no page';
    if (f.page) {
      const spec = PageSpec.safeParse(f.page.spec);
      pageInfo = `page "${f.page.slug}"${detailed && spec.success ? ` sections: ${spec.data.sections.map((s) => `${s.id}(${s.type})`).join(', ')}` : ''}`;
    }
    lines.push(`- ${f.key} "${f.name}" [${f.kind}, ${f.status}] — ${clip(f.why, 140)} · ${pageInfo}`);
  }
  const loosePages = await db.page.findMany({ where: { focusId: null } });
  for (const p of loosePages) lines.push(`- (page without focus) "${p.slug}"`);

  if (collections.length) {
    lines.push('\nCollections');
    for (const c of collections) {
      const def = CollectionDef.safeParse(c.def);
      const fields = detailed && def.success ? ` fields: ${def.data.fields.map((x) => `${x.key}:${x.type}${x.options ? `(${x.options.join('|')})` : ''}`).join(', ')}` : '';
      lines.push(`- ${c.key} (${c._count.records} records)${fields}`);
    }
  }

  lines.push(`\nAgents${agents.length ? '' : ': none yet'}`);
  for (const a of agents) {
    const t = a.tasks[0];
    const r = a.runs[0];
    const progress = r?.progress as RunProgress | null;
    lines.push(
      `- ${a.name} (${a.role}${a.focus ? `, ${a.focus.key}` : ''}) — ${a.status}${t ? `: "${clip(t.title, 80)}" [${t.status}]` : ''}${progress ? ` · ${progress.label}${progress.total ? ` ${progress.current ?? 0}/${progress.total}` : ''}` : ''} · id ${a.id}`,
    );
  }

  if (tasks.length) {
    lines.push('\nRecent tasks');
    for (const t of tasks) {
      const v = t.verdict as JudgeVerdict | null;
      lines.push(`- [${t.status}${v ? ` · judged ${v.status}` : ''}] "${clip(t.title, 80)}" by ${t.agent.name}${v?.summary ? ` — ${clip(v.summary, 140)}` : ''} · task ${t.id}`);
    }
  }

  if (decisions.length) {
    lines.push('\nOpen decisions (waiting for the founder)');
    for (const d of decisions) lines.push(`- [${d.kind}] ${clip(d.title, 120)}`);
  }

  lines.push(`\nToday (${today.date})${today.items.length ? '' : ': nothing set'}`);
  if (today.note) lines.push(`Note: ${today.note}`);
  for (const i of today.items) lines.push(`- [${i.done ? 'x' : ' '}] ${i.title}`);

  if (outputs.length) {
    lines.push('\nRecent outputs');
    for (const o of outputs) lines.push(`- ${o.title} (${o.type}) by ${o.agent?.name ?? 'Noor'} · ${o.createdAt.toISOString().slice(0, 10)}`);
  }
  if (routines.length) {
    lines.push('\nRoutines');
    for (const r of routines) lines.push(`- ${r.title} [${r.kind}] "${r.schedule}"`);
  }
  return lines.join('\n');
}

export async function taskDetail(id: string) {
  const task = await db.task.findUnique({
    where: { id },
    include: { agent: true, runs: { orderBy: { startedAt: 'desc' }, take: 1 }, artifacts: true },
  });
  if (!task) return 'Task not found.';
  const run = task.runs[0];
  return {
    title: task.title,
    status: task.status,
    agent: task.agent.name,
    verdict: task.verdict,
    summary: clip(task.summary ?? run?.result ?? '', 2000),
    outputs: task.artifacts.map((a) => ({ title: a.title, type: a.type, path: a.path })),
    lastActivity: run?.lastActivity,
  };
}
