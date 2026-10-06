import { Effort, type AgentDetailDTO, type CompiledPrompt, type JudgeVerdict, type RunDTO } from '@opervio/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { bus } from '../bus';
import { db } from '../db';
import { resolveDecision } from '../domain/decisions';
import { agentDTO, artifactDTO, decisionDTO, messageDTO, runBriefDTO, runEventDTO, taskDTO } from '../domain/dto';
import { ValidationError } from '../domain/pages';
import { resumeTask, stopAgentWork, updateAgentSettings } from '../domain/work';
import { cancelNoor, sendToNoor } from '../noor/turn';

const agentInclude = {
  focus: { include: { page: true } },
  tasks: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  runs: { orderBy: { startedAt: 'desc' as const }, take: 1 },
  _count: { select: { artifacts: true } },
};

async function runDTO(id: string): Promise<RunDTO | null> {
  const run = await db.run.findUnique({
    where: { id },
    include: { events: { orderBy: { ts: 'asc' }, take: 400 }, artifacts: { include: { agent: true, task: true, focus: { include: { page: true } } } } },
  });
  if (!run) return null;
  return {
    ...runBriefDTO(run),
    taskId: run.taskId,
    agentId: run.agentId,
    prompt: (run.prompt as unknown as CompiledPrompt) ?? null,
    result: run.result,
    error: run.error,
    verdict: (run.verdict as unknown as JudgeVerdict) ?? null,
    toolsUsed: run.toolsUsed,
    events: run.events.map(runEventDTO),
    outputs: run.artifacts.map(artifactDTO),
  };
}

export function workRoutes(app: FastifyInstance) {
  // ── Noor conversation ──────────────────────────────────────────────
  app.get<{ Querystring: { limit?: string } }>('/api/messages', async (req) => {
    const take = Math.min(Number(req.query.limit ?? 60), 200);
    const msgs = await db.message.findMany({ orderBy: { createdAt: 'desc' }, take });
    return msgs.reverse().map(messageDTO);
  });

  app.post('/api/messages', async (req) => {
    const { text } = z.object({ text: z.string().trim().min(1).max(8000) }).parse(req.body);
    return sendToNoor(text);
  });

  app.post<{ Params: { id: string } }>('/api/messages/:id/cancel', async (req) => {
    cancelNoor(req.params.id);
    return { ok: true };
  });

  // ── Agents & runs ──────────────────────────────────────────────────
  app.get('/api/agents', async () => {
    const agents = await db.agent.findMany({ include: agentInclude, orderBy: { updatedAt: 'desc' }, take: 100 });
    const done = await db.task.groupBy({ by: ['agentId'], where: { status: 'done' }, _count: true });
    return agents.map((a) => agentDTO(a, done.find((d) => d.agentId === a.id)?._count ?? 0));
  });

  app.get<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    const agent = await db.agent.findUnique({ where: { id: req.params.id }, include: agentInclude });
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    const [tasks, runs, done] = await Promise.all([
      db.task.findMany({ where: { agentId: agent.id }, orderBy: { createdAt: 'desc' }, take: 20, include: { agent: true, focus: true } }),
      db.run.findMany({ where: { agentId: agent.id }, orderBy: { startedAt: 'desc' }, take: 20 }),
      db.task.count({ where: { agentId: agent.id, status: 'done' } }),
    ]);
    const detail: AgentDetailDTO = {
      ...agentDTO(agent, done),
      objective: agent.objective,
      tasks: tasks.map(taskDTO),
      runs: runs.map(runBriefDTO),
      latestRun: runs[0] ? await runDTO(runs[0].id) : null,
    };
    return detail;
  });

  app.patch<{ Params: { id: string } }>('/api/agents/:id', async (req) => {
    const body = z
      .object({ provider: z.enum(['claude', 'codex', 'auto']).optional(), model: z.string().max(60).optional(), effort: Effort.optional() })
      .parse(req.body);
    const agent = await updateAgentSettings(req.params.id, body);
    return { id: agent.id };
  });

  app.post<{ Params: { id: string } }>('/api/agents/:id/stop', async (req) => {
    const { mode } = z.object({ mode: z.enum(['stop', 'pause']) }).parse(req.body);
    const task = await stopAgentWork(req.params.id, mode);
    return { ok: Boolean(task) };
  });

  /** Resume a paused/waiting task, or re-run the latest task (e.g. after changing effort). */
  app.post<{ Params: { id: string } }>('/api/agents/:id/resume', async (req) => {
    const { note } = z.object({ note: z.string().max(2000).optional() }).parse(req.body ?? {});
    const task = await db.task.findFirst({ where: { agentId: req.params.id, status: { in: ['waiting', 'failed', 'cancelled', 'done'] } }, orderBy: { updatedAt: 'desc' } });
    if (!task) throw new ValidationError('Nothing to resume');
    await resumeTask(task.id, note ? `The founder says: ${note}` : task.status === 'done' ? 'The founder asked you to run this task again with fresh eyes — improve on the previous result.' : 'Continue where you left off.');
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>('/api/runs/:id', async (req, reply) => (await runDTO(req.params.id)) ?? reply.code(404).send({ error: 'Run not found' }));

  app.get<{ Querystring: { focusId?: string } }>('/api/tasks', async (req) => {
    const tasks = await db.task.findMany({
      where: req.query.focusId ? { focusId: req.query.focusId } : {},
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { agent: true, focus: true },
    });
    return tasks.map(taskDTO);
  });

  // ── Decisions ──────────────────────────────────────────────────────
  app.get<{ Querystring: { status?: string } }>('/api/decisions', async (req) => {
    const ds = await db.decision.findMany({
      where: req.query.status === 'all' ? {} : { status: 'open' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { agent: true, focus: true },
    });
    return ds.map(decisionDTO);
  });

  app.get<{ Params: { id: string } }>('/api/decisions/:id', async (req, reply) => {
    const d = await db.decision.findUnique({ where: { id: req.params.id }, include: { agent: true, focus: true } });
    return d ? decisionDTO(d) : reply.code(404).send({ error: 'Not found' });
  });

  app.post<{ Params: { id: string } }>('/api/decisions/:id/resolve', async (req) => {
    const { choice, note } = z.object({ choice: z.string().min(1).max(60), note: z.string().max(2000).nullish() }).parse(req.body);
    await resolveDecision(req.params.id, choice, note);
    bus.invalidate('decisions', 'home', 'messages');
    return { ok: true };
  });
}
