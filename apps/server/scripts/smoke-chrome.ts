/**
 * Live check that agents can work in the founder's own Chrome (Claude in Chrome).
 * Runs one tiny agent task on a throwaway database; approve the Chrome prompt when it appears.
 * Usage: DATABASE_URL=…/opervio_chrome OPERVIO_HOME=<dir> PORT=4102 tsx scripts/smoke-chrome.ts
 */
import { DEFAULT_AI_SETTINGS } from '@opervio/contracts';
import { buildApp } from '../src/app';
import { config } from '../src/config';
import { db } from '../src/db';
import { spawnAgent } from '../src/domain/work';
import { recoverQueue, setRunner } from '../src/runtime/queue';
import { runTask } from '../src/runtime/runner';
import { setAiSettings } from '../src/settings';
import { installHooks } from '../src/tools/hook';

await installHooks();
const app = await buildApp();
await app.listen({ port: config.port, host: config.host });
setRunner(runTask);
await recoverQueue();
await db.founder.upsert({
  where: { id: 'founder' },
  create: { id: 'founder', name: 'Test', language: 'en', alwaysAsk: ['spend_money', 'send_messages', 'publish'], timezone: 'Africa/Cairo', setupAt: new Date() },
  update: {},
});
await setAiSettings({ ...DEFAULT_AI_SETTINGS, specialist: { provider: 'claude', model: 'haiku', effort: 'low' } });
const { task } = await spawnAgent({
  agent: { name: 'Tester', role: 'Browser check', effort: 'low' },
  task: {
    title: 'Read example.com in Chrome',
    objective: 'In the founder’s own Chrome, open a new tab at https://example.com, read the page heading, close that tab, and save the heading to heading.md.',
    taskType: 'research',
    deliverable: 'heading.md containing the page heading',
    successCriteria: ['heading.md contains the heading text of example.com'],
    expectedOutputs: ['md'],
    effort: 'low',
  },
});
const t0 = Date.now();
while (Date.now() - t0 < 12 * 60_000) {
  await new Promise((r) => setTimeout(r, 3000));
  const t = await db.task.findUnique({ where: { id: task.id } });
  if (t && ['done', 'failed', 'waiting', 'cancelled'].includes(t.status)) break;
}
const runs = await db.run.findMany({ where: { taskId: task.id }, include: { events: { orderBy: { ts: 'asc' } }, artifacts: true }, orderBy: { startedAt: 'asc' } });
for (const r of runs) {
  console.log(`\n=== attempt ${r.attempt} ${r.status} tools=${r.toolsUsed.join(',')}`);
  for (const e of r.events) console.log(`  ${e.ts.toISOString().slice(11, 19)} [${e.kind}] ${e.label}`);
  console.log('  verdict:', JSON.stringify(r.verdict));
  console.log('  outputs:', r.artifacts.map((a) => a.path));
}
console.log('notifications:', (await db.notification.findMany()).map((n) => n.title));
console.log('TASK', (await db.task.findUnique({ where: { id: task.id } }))?.status);
await app.close();
process.exit(0);
