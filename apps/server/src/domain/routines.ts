import { formatZodError, RoutineSpec } from '@opervio/contracts';
import { Cron } from 'croner';
import { bus } from '../bus';
import { db, Prisma } from '../db';
import { getFounder } from './founder';
import { ValidationError } from './pages';
import { focusByKeyOrId } from './work';

export async function nextRun(schedule: string, from = new Date()) {
  const f = await getFounder();
  try {
    return new Cron(schedule, { timezone: f?.timezone || undefined, paused: true }).nextRun(from);
  } catch (err) {
    throw new ValidationError(`Invalid schedule "${schedule}": ${(err as Error).message}. Use 5-field cron like "0 8 * * *".`);
  }
}

export async function createRoutine(input: unknown) {
  const parsed = RoutineSpec.safeParse(input);
  if (!parsed.success) throw new ValidationError(formatZodError(parsed.error, 'routine'));
  const r = parsed.data;
  if (r.kind === 'task' && (!r.task || !r.agent)) throw new ValidationError('A task routine needs "agent" and "task".');
  const focus = await focusByKeyOrId(r.focus);
  const routine = await db.routine.create({
    data: {
      title: r.title,
      schedule: r.schedule,
      kind: r.kind,
      message: r.message ?? null,
      agent: (r.agent ?? Prisma.DbNull) as Prisma.InputJsonValue,
      task: (r.task ?? Prisma.DbNull) as Prisma.InputJsonValue,
      focusId: focus?.id ?? null,
      nextRunAt: await nextRun(r.schedule),
    },
  });
  bus.invalidate('routines', 'settings');
  return routine;
}
