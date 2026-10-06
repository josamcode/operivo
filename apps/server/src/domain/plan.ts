import type { FocusSpec, MessageRef, PageIcon, PageSpec, PlanProposal } from '@opervio/contracts';
import { bus } from '../bus';
import { db, Prisma } from '../db';
import { log } from '../log';
import { createPage, updatePage } from './pages';
import { defineCollection } from './records';
import { createRoutine } from './routines';
import { setToday } from './today';
import { spawnAgent } from './work';

const ICON_HINTS: [RegExp, PageIcon][] = [
  [/client|lead|sales|income|money|عملا|دخل/i, 'briefcase'],
  [/content|video|youtube|tiktok|محتو|فيديو/i, 'video'],
  [/learn|study|course|تعلم|مذاكر|كورس/i, 'graduation-cap'],
  [/fit|gym|health|workout|جيم|رياض/i, 'dumbbell'],
  [/code|software|dev|برمج/i, 'code'],
  [/university|college|جامع/i, 'book-open'],
];

const guessIcon = (name: string): PageIcon => ICON_HINTS.find(([re]) => re.test(name))?.[1] ?? 'layers';

export const defaultPage = (f: Pick<FocusSpec, 'name' | 'why'>): PageSpec => ({
  title: f.name.slice(0, 40),
  icon: guessIcon(f.name),
  sections: [
    { type: 'hero', summary: f.why.slice(0, 500), width: 'full' },
    { type: 'agents', title: 'Team', width: 'half' },
    { type: 'activity', title: 'Activity', width: 'half' },
    { type: 'outputs', title: 'Outputs', layout: 'grid', width: 'full' },
  ],
});

/** Applies a founder-confirmed plan: focuses → collections → pages → agents → today → routines. */
export async function applyPlan(plan: PlanProposal) {
  const refs: MessageRef[] = [];
  const focusIds = new Map<string, string>();
  const existingCount = await db.focus.count();

  for (const [i, f] of plan.focuses.entries()) {
    const focus = await db.focus.upsert({
      where: { key: f.key },
      create: { key: f.key, name: f.name, kind: f.kind, why: f.why, cadence: f.cadence ?? null, order: existingCount + i },
      update: { name: f.name, kind: f.kind, why: f.why, cadence: f.cadence ?? null, status: 'active' },
      include: { page: true },
    });
    focusIds.set(f.key, focus.id);
    for (const c of f.collections ?? []) await defineCollection(c, focus.id);
    const spec = f.page ?? defaultPage(f);
    try {
      const page = focus.page
        ? (await updatePage(focus.page.slug, [{ op: 'replace_sections', sections: spec.sections }])).page
        : (await createPage({ spec, focusId: focus.id })).page;
      refs.push({ kind: 'page', slug: page.slug, title: page.title });
    } catch (err) {
      log.warn({ err: (err as Error).message, focus: f.key }, 'plan page failed; using default page');
      const page = focus.page ?? (await createPage({ spec: defaultPage(f), focusId: focus.id })).page;
      refs.push({ kind: 'page', slug: page.slug, title: page.title });
    }
  }

  for (const a of plan.agents ?? []) {
    try {
      const { agent } = await spawnAgent({
        agent: { name: a.name, role: a.role, provider: a.provider, model: a.model, effort: a.effort },
        task: a.task,
        focus: a.focus,
      });
      refs.push({ kind: 'agent', id: agent.id, name: agent.name });
    } catch (err) {
      log.warn({ err: (err as Error).message, agent: a.name }, 'plan agent failed');
    }
  }

  if (plan.today?.length) await setToday(plan.today, plan.todayNote ?? null);
  for (const r of plan.routines ?? []) {
    await createRoutine(r).catch((err) => log.warn({ err: (err as Error).message }, 'plan routine failed'));
  }

  await db.message.create({
    data: { role: 'noor', content: plan.confirmMessage, refs: refs as unknown as Prisma.InputJsonValue },
  });
  bus.invalidate('messages', 'nav', 'home', 'focuses', 'agents', 'today', 'bootstrap');
  return { refs, focusIds };
}
