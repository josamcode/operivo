import { TodaySpec, type TodayDTO } from '@opervio/contracts';
import { z } from 'zod';
import { bus } from '../bus';
import { db } from '../db';
import { localDate } from '../lib/time';
import { getFounder } from './founder';
import { focusByKeyOrId } from './work';

export async function today() {
  const f = await getFounder();
  return localDate(f?.timezone ?? 'UTC');
}

/** Replaces the open items for today with Noor's list; finished items stay. */
export async function setToday(itemsInput: unknown, note?: string | null) {
  const items = z.array(TodaySpec).max(8).parse(itemsInput);
  const date = await today();
  await db.todayItem.deleteMany({ where: { date, done: false, source: { not: 'routine' } } });
  const doneCount = await db.todayItem.count({ where: { date } });
  for (const [i, item] of items.entries()) {
    const focus = await focusByKeyOrId(item.focus);
    await db.todayItem.create({ data: { date, title: item.title, minutes: item.minutes ?? null, focusId: focus?.id ?? null, order: doneCount + i } });
  }
  if (note !== undefined && note !== null) {
    await db.dayNote.upsert({ where: { date }, create: { date, note }, update: { note } });
  }
  bus.invalidate('today', 'home');
}

export async function addTodayItem(title: string, opts: { focusId?: string | null; source?: string } = {}) {
  const date = await today();
  const order = await db.todayItem.count({ where: { date } });
  await db.todayItem.create({ data: { date, title, focusId: opts.focusId ?? null, order, source: opts.source ?? 'noor' } });
  bus.invalidate('today', 'home');
}

export async function getToday(): Promise<TodayDTO> {
  const date = await today();
  const [items, note] = await Promise.all([
    db.todayItem.findMany({ where: { date }, orderBy: [{ done: 'asc' }, { order: 'asc' }], include: { focus: true } }),
    db.dayNote.findUnique({ where: { date } }),
  ]);
  return {
    date,
    note: note?.note ?? null,
    items: items.map((i) => ({ id: i.id, title: i.title, minutes: i.minutes, done: i.done, focus: i.focus ? { id: i.focus.id, name: i.focus.name } : null })),
  };
}

export async function toggleToday(id: string, done: boolean) {
  await db.todayItem.update({ where: { id }, data: { done } });
  bus.invalidate('today', 'home');
}
