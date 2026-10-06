import PQueue from 'p-queue';
import { bus } from '../bus';
import { db } from '../db';
import { log } from '../log';
import { getAiSettings } from '../settings';

/**
 * The whole MVP runtime: a database-backed task table + an in-process p-queue.
 * No Redis, no workflow engine. Tasks survive restarts because state lives in Postgres.
 */
const queue = new PQueue({ concurrency: 3 });
const inQueue = new Set<string>();
const controllers = new Map<string, { abort: AbortController; mode: 'stop' | 'pause' | null }>();

type Runner = (taskId: string, signal: AbortSignal) => Promise<void>;
let runner: Runner | null = null;

export function setRunner(fn: Runner) {
  runner = fn;
}

export async function configureQueue() {
  const ai = await getAiSettings();
  queue.concurrency = ai.maxConcurrentAgents;
}

export function enqueueTask(taskId: string) {
  if (inQueue.has(taskId)) return;
  inQueue.add(taskId);
  void queue.add(async () => {
    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task || task.status !== 'queued' || !runner) {
      inQueue.delete(taskId);
      return;
    }
    const abort = new AbortController();
    controllers.set(taskId, { abort, mode: null });
    try {
      await runner(taskId, abort.signal);
    } catch (err) {
      log.error({ err, taskId }, 'task runner crashed');
      await db.task.update({ where: { id: taskId }, data: { status: 'failed', summary: (err as Error).message.slice(0, 500) } }).catch(() => {});
      bus.invalidate('tasks', 'agents', 'home');
    } finally {
      controllers.delete(taskId);
      inQueue.delete(taskId);
    }
  });
}

export function cancelMode(taskId: string) {
  return controllers.get(taskId)?.mode ?? null;
}

/** Stop = cancelled for good. Pause = waiting, resumable later with the same session. */
export async function cancelTask(taskId: string, mode: 'stop' | 'pause') {
  const ctl = controllers.get(taskId);
  if (ctl) {
    ctl.mode = mode;
    ctl.abort.abort();
    return;
  }
  // Not running yet (queued) — just update state.
  const task = await db.task.update({ where: { id: taskId }, data: { status: mode === 'stop' ? 'cancelled' : 'waiting' } });
  await db.agent.update({ where: { id: task.agentId }, data: { status: mode === 'stop' ? 'stopped' : 'waiting' } });
  bus.invalidate('tasks', 'agents', 'home');
}

/** After a restart: interrupted runs are marked, their tasks re-queued (they resume their session). */
export async function recoverQueue() {
  await configureQueue();
  const interrupted = await db.run.updateMany({
    where: { status: { in: ['preparing', 'running', 'judging'] } },
    data: { status: 'failed', error: 'Interrupted by restart', finishedAt: new Date() },
  });
  await db.task.updateMany({ where: { status: 'running' }, data: { status: 'queued' } });
  await db.agent.updateMany({ where: { status: 'working' }, data: { status: 'idle' } });
  const queued = await db.task.findMany({ where: { status: 'queued' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  queued.forEach((t) => enqueueTask(t.id));
  if (interrupted.count || queued.length) log.info({ interrupted: interrupted.count, queued: queued.length }, 'queue recovered');
}

export const queueStats = () => ({ running: queue.pending, waiting: queue.size, concurrency: queue.concurrency });
