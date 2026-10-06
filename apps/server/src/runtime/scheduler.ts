import { bus } from '../bus';
import { db } from '../db';
import { addTodayItem } from '../domain/today';
import { nextRun } from '../domain/routines';
import { notify } from '../domain/notify';
import { spawnAgent } from '../domain/work';
import { log } from '../log';
import { noorSystemTurn } from '../noor/turn';

/**
 * Lightweight routines: a 30s tick over a database table. Recurring work becomes ordinary tasks,
 * reminders, or a prompt to Noor. No workflow scheduler.
 */
async function fire(r: Awaited<ReturnType<typeof db.routine.findFirstOrThrow>>) {
  switch (r.kind) {
    case 'reminder':
      await notify('reminder', r.title, r.message, null);
      await addTodayItem(r.message || r.title, { focusId: r.focusId, source: 'routine' });
      break;
    case 'noor':
      await noorSystemTurn(`Routine "${r.title}" is due. ${r.message ?? ''}`.trim(), { label: r.title });
      break;
    case 'task':
      await spawnAgent({ agent: r.agent, task: r.task, focus: r.focusId, routineId: r.id });
      break;
  }
}

export async function tick() {
  const due = await db.routine.findMany({ where: { enabled: true, nextRunAt: { lte: new Date() } } });
  for (const r of due) {
    // Advance first so a crash can't fire the same occurrence twice.
    await db.routine.update({ where: { id: r.id }, data: { lastRunAt: new Date(), nextRunAt: await nextRun(r.schedule) } });
    try {
      await fire(r);
      log.info({ routine: r.title }, 'routine fired');
    } catch (err) {
      log.warn({ err: (err as Error).message, routine: r.title }, 'routine failed');
    }
  }
  if (due.length) bus.invalidate('routines');
}

export function startScheduler() {
  const timer = setInterval(() => void tick().catch((err) => log.error({ err }, 'scheduler tick failed')), 30_000);
  timer.unref();
  void tick();
}
