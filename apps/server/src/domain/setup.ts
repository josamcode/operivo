import { SetupInput } from '@opervio/contracts';
import { bus } from '../bus';
import { db } from '../db';
import { noorSystemTurn } from '../noor/turn';
import { remember } from './memory';

const normalizeUrl = (u?: string) => (u ? (/^https?:\/\//i.test(u) ? u : `https://${u}`) : undefined);

/** First run: store the founder, seed a few memories, then hand over to Noor — no empty app. */
export async function completeSetup(raw: unknown) {
  const input = SetupInput.parse(raw);
  const links = {
    github: normalizeUrl(input.links.github),
    website: normalizeUrl(input.links.website),
    social: normalizeUrl(input.links.social),
  };
  const data = {
    name: input.name,
    language: input.language,
    work: input.work,
    plate: input.plate,
    timeAvailable: input.timeAvailable,
    links,
    commStyle: input.commStyle,
    autonomy: input.autonomy,
    alwaysAsk: input.alwaysAsk,
    timezone: input.timezone || 'UTC',
    setupAt: new Date(),
  };
  const existing = await db.founder.findUnique({ where: { id: 'founder' } });
  await db.founder.upsert({ where: { id: 'founder' }, create: { id: 'founder', ...data }, update: data });

  await remember({ kind: 'fact', content: `${input.name} works on: ${input.work}`, source: 'setup' });
  await remember({ kind: 'fact', content: `Realistic available time: ${input.timeAvailable}`, source: 'setup' });
  await remember({ kind: 'preference', content: `Prefers ${input.commStyle} communication in ${input.language === 'ar' ? 'Egyptian Arabic' : 'English'}`, source: 'setup' });
  bus.invalidate('bootstrap', 'home', 'settings');

  if (!existing?.setupAt) {
    await noorSystemTurn(
      `First conversation after setup. The founder just introduced themselves and wrote what is on their plate (shown in the thread).
1. In 2–4 short lines, say what you understood and what you think the priority is.
2. Call propose_plan with the focus structure, one page per focus (with collections where structured data helps), the first 2–4 useful specialist agents with one concrete task each, today's founder to-dos, and a daily-plan routine at their morning.
3. End with one short line asking them to confirm or adjust.`,
      { visibleText: input.plate },
    );
  }
}
