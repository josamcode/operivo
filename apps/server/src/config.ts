import { config as loadEnv } from 'dotenv';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

loadEnv({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });

const home = resolve(process.env.OPERVIO_HOME || join(homedir(), 'Opervio'));

export const config = {
  port: Number(process.env.PORT || 4100),
  host: '127.0.0.1',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://opervio:opervio@127.0.0.1:5434/opervio',
  isProd: process.env.NODE_ENV === 'production',
  /** Test-only: replaces CLI providers with a scripted in-process provider. */
  fakeProviders: process.env.OPERVIO_FAKE_PROVIDERS === '1',
  repoRoot: resolve(import.meta.dirname, '../../..'),
  webDist: resolve(import.meta.dirname, '../../web/dist'),
  paths: {
    home,
    workspace: join(home, 'workspace'),
    runtime: join(home, 'runtime'),
    pythonVenv: join(home, 'python', '.venv'),
  },
};

export const serverUrl = () => `http://${config.host}:${config.port}`;
