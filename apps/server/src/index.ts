import fs from 'fs-extra';
import { buildApp } from './app';
import { config, serverUrl } from './config';
import { db } from './db';
import { log } from './log';
import { providerStatus } from './providers/registry';
import { recoverQueue, setRunner } from './runtime/queue';
import { runTask } from './runtime/runner';
import { startScheduler } from './runtime/scheduler';
import { installHooks } from './tools/hook';
import { ensurePython, pythonStatus } from './tools/python';

async function main() {
  for (const dir of Object.values(config.paths)) await fs.ensureDir(dir);
  await fs.ensureDir(`${config.paths.runtime}/scratch`);
  await installHooks();
  await db.$connect();

  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });

  setRunner(runTask);
  await recoverQueue();
  startScheduler();

  const providers = await providerStatus(true);
  log.info(
    { claude: providers.claude.available ? providers.claude.version : providers.claude.error, codex: providers.codex.available ? providers.codex.version : providers.codex.error },
    'providers',
  );
  if (!config.fakeProviders) {
    const py = await pythonStatus();
    if (py.available && (!py.venv || py.packages.length < 8)) void ensurePython();
  }
  log.info(`Opervio running at ${serverUrl()}  ·  home: ${config.paths.home}`);
}

main().catch((err) => {
  log.fatal({ err }, 'Opervio failed to start');
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await db.$disconnect().catch(() => {});
    process.exit(0);
  });
}
