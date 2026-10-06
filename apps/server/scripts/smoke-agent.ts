/**
 * Dev smoke: one tiny real agent run through the whole pipeline.
 * Usage: DATABASE_URL=…/opervio_dev OPERVIO_HOME=<dir> tsx scripts/smoke-agent.ts
 */
import { buildApp } from '../src/app';
import { config } from '../src/config';
import { db } from '../src/db';
import { spawnAgent } from '../src/domain/work';
import { setAiSettings } from '../src/settings';
import { DEFAULT_AI_SETTINGS } from '@opervio/contracts';
import { recoverQueue, setRunner } from '../src/runtime/queue';
import { runTask } from '../src/runtime/runner';
import { installHooks } from '../src/tools/hook';

await installHooks();
const app = await buildApp();
await app.listen({ port: config.port, host: config.host });
setRunner(runTask);
await recoverQueue();
await db.founder.upsert({
  where: { id: 'founder' },
  create: { id: 'founder', name: 'Gerges', language: 'en', work: 'Software developer and content creator', timeAvailable: '3h/day', alwaysAsk: ['spend_money', 'send_messages', 'publish'], timezone: 'Africa/Cairo', setupAt: new Date() },
  update: {},
});
await setAiSettings({ ...DEFAULT_AI_SETTINGS, specialist: { provider: 'claude', model: 'haiku', effort: 'low' } });
const focus = await db.focus.upsert({ where: { key: 'learning' }, create: { key: 'learning', name: 'Learning', kind: 'continuous', why: 'Learn AI engineering 45 minutes a day' }, update: {} });
const { task } = await spawnAgent({
  agent: { name: 'Mariam', role: 'Tutor', effort: 'low' },
  focus: 'learning',
  task: {
    title: 'Week 1 AI study plan',
    objective: 'Write a short 5-day study plan (45 minutes/day) to start learning practical AI engineering with LLM APIs. Keep it brief.',
    taskType: 'learning',
    deliverable: 'A markdown file week-1-plan.md with 5 daily sessions',
    successCriteria: ['week-1-plan.md exists with exactly 5 daily sessions', 'Each session has a goal and one concrete exercise'],
    expectedOutputs: ['md'],
    effort: 'low',
  },
});
console.log('task', task.id, 'focus', focus.id);
const t0 = Date.now();
while (Date.now() - t0 < 8 * 60_000) {
  await new Promise((r) => setTimeout(r, 4000));
  const t = await db.task.findUnique({ where: { id: task.id } });
  if (t && ['done', 'failed', 'waiting', 'cancelled'].includes(t.status)) break;
}
const runs = await db.run.findMany({ where: { taskId: task.id }, include: { events: { orderBy: { ts: 'asc' } } }, orderBy: { startedAt: 'asc' } });
for (const r of runs) {
  console.log(`\n=== run ${r.attempt} ${r.provider}/${r.model}/${r.effort} ${r.status} cost=$${r.costUsd?.toFixed(4)} tools=${r.toolsUsed.join(',')}`);
  for (const e of r.events) console.log(`  [${e.kind}] ${e.label}`);
  console.log('  verdict:', JSON.stringify(r.verdict));
  console.log('  engineered:', (r.prompt as { engineered?: boolean; engineerNote?: string })?.engineerNote);
}
const t = await db.task.findUnique({ where: { id: task.id } });
console.log('\nTASK', t?.status);
console.log('ARTIFACTS', (await db.artifact.findMany({ where: { taskId: task.id } })).map((a) => `${a.type} ${a.path} ${a.sizeBytes}b`));
console.log('PROMPT PREVIEW:\n', ((runs[0]?.prompt as { text?: string })?.text ?? '').slice(0, 2500));
await app.close();
process.exit(0);
