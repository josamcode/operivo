/**
 * E2E server: a throwaway database + the scripted test provider, so the founder flow runs
 * end to end without touching real data or spending Claude/Codex quota.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const serverDir = resolve(import.meta.dirname, '../../server');
const require = createRequire(join(serverDir, 'package.json'));
const pg = require('pg');
const admin = process.env.E2E_ADMIN_URL || 'postgresql://opervio:opervio@127.0.0.1:5434/opervio';
const dbName = `opervio_e2e_${Date.now()}`;
const url = admin.replace(/\/[^/]+$/, `/${dbName}`);

const client = new pg.Client({ connectionString: admin });
await client.connect();
// Windows can't deliver SIGTERM to this launcher, so sweep databases left by earlier e2e runs first.
const stale = await client.query("SELECT datname FROM pg_database WHERE datname LIKE 'opervio_e2e_%'");
for (const { datname } of stale.rows) await client.query(`DROP DATABASE IF EXISTS ${datname} WITH (FORCE)`);
await client.query(`CREATE DATABASE ${dbName}`);
await client.end();
spawnSync('npx', ['prisma', 'migrate', 'deploy'], { cwd: serverDir, env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit', shell: true });

const home = mkdtempSync(join(tmpdir(), 'opervio-e2e-'));
const server = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: serverDir,
  env: { ...process.env, DATABASE_URL: url, OPERVIO_HOME: home, OPERVIO_FAKE_PROVIDERS: '1', PORT: '4199', LOG_LEVEL: 'warn', NODE_ENV: 'production' },
  stdio: 'inherit',
  shell: true,
});

let cleaning = false;
const cleanup = async () => {
  if (cleaning) return;
  cleaning = true;
  if (process.platform === 'win32' && server.pid) spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  else server.kill();
  const c = new pg.Client({ connectionString: admin });
  await c.connect().catch(() => {});
  await c.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => {});
  await c.end().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
server.on('exit', () => void cleanup());
