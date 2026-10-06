import { PageSpec, type FocusSummaryDTO, type HomeDTO } from '@opervio/contracts';
import { db } from '../db';
import { localDate } from '../lib/time';
import { aggregate } from './data';
import { agentDTO, artifactDTO, decisionDTO, focusDTO, founderDTO } from './dto';
import { requireFounder } from './founder';
import { getToday } from './today';

const fmt = (n: number | null) => (n === null ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Headline numbers for a focus tile: the page's first KPIs (real data), else work counts. */
async function headline(focusId: string, spec: PageSpec | null): Promise<{ label: string; value: string }[]> {
  const kpis = spec?.sections.find((s) => s.type === 'kpis');
  if (kpis && kpis.type === 'kpis') {
    return Promise.all(
      kpis.items.slice(0, 3).map(async (k) => ({
        label: k.label,
        value: k.value !== undefined ? String(k.value) : fmt(k.compute ? await aggregate(k.compute, focusId) : null),
      })),
    );
  }
  return [];
}

export async function getHome(): Promise<HomeDTO> {
  const founder = await requireFounder();
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [today, agents, focuses, decisions, outputs, doneTasks, recentOutputs] = await Promise.all([
    getToday(),
    db.agent.findMany({
      where: { OR: [{ status: { in: ['working', 'waiting', 'idle'] } }, { updatedAt: { gte: new Date(Date.now() - 86400_000) } }] },
      include: { focus: { include: { page: true } }, tasks: { orderBy: { createdAt: 'desc' }, take: 1 }, runs: { orderBy: { startedAt: 'desc' }, take: 1 }, _count: { select: { artifacts: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    }),
    db.focus.findMany({
      where: { status: 'active' },
      orderBy: { order: 'asc' },
      include: { page: true, _count: { select: { artifacts: true } }, agents: { select: { status: true } }, tasks: { select: { status: true } } },
    }),
    db.decision.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'desc' }, take: 6, include: { agent: true, focus: true } }),
    db.artifact.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { agent: true, task: true, focus: { include: { page: true } } } }),
    db.task.findMany({ where: { status: 'done', finishedAt: { gte: new Date(Date.now() - 14 * 86400_000) } }, select: { finishedAt: true } }),
    db.artifact.findMany({ where: { createdAt: { gte: new Date(Date.now() - 14 * 86400_000) } }, select: { createdAt: true } }),
  ]);

  const focusSummaries: FocusSummaryDTO[] = await Promise.all(
    focuses.map(async (f) => {
      const spec = f.page ? PageSpec.safeParse(f.page.spec) : null;
      return {
        ...focusDTO(f),
        headline: await headline(f.id, spec?.success ? spec.data : null),
        activeAgents: f.agents.filter((a) => a.status === 'working').length,
        openTasks: f.tasks.filter((t) => ['queued', 'running', 'waiting'].includes(t.status)).length,
        doneTasks: f.tasks.filter((t) => t.status === 'done').length,
        outputs: f._count.artifacts,
      };
    }),
  );

  const days: HomeDTO['progress'] = [];
  for (let i = 13; i >= 0; i--) {
    const d = localDate(founder.timezone, new Date(Date.now() - i * 86400_000));
    days.push({
      date: d,
      tasksDone: doneTasks.filter((t) => t.finishedAt && localDate(founder.timezone, t.finishedAt) === d).length,
      outputs: recentOutputs.filter((o) => localDate(founder.timezone, o.createdAt) === d).length,
    });
  }

  const order = { working: 0, waiting: 1, idle: 2, done: 3, failed: 4, stopped: 5 } as Record<string, number>;
  return {
    founder: founderDTO(founder),
    today,
    agents: agents.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)).map((a) => agentDTO(a)),
    focuses: focusSummaries,
    decisions: decisions.map(decisionDTO),
    outputs: outputs.map(artifactDTO),
    progress: days,
    counts: {
      activeAgents: agents.filter((a) => a.status === 'working').length,
      tasksDoneThisWeek: doneTasks.filter((t) => t.finishedAt && t.finishedAt >= weekAgo).length,
      outputsThisWeek: recentOutputs.filter((o) => o.createdAt >= weekAgo).length,
    },
  };
}
