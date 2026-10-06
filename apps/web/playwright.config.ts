import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4199', viewport: { width: 1440, height: 900 }, channel: 'chrome', trace: 'retain-on-failure' },
  webServer: {
    command: 'node e2e/start-server.mjs',
    url: 'http://127.0.0.1:4199/api/bootstrap',
    timeout: 180_000,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
});
