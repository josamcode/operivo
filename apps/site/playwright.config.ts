import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4180', channel: 'chrome' },
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180',
    timeout: 60_000,
    reuseExistingServer: true,
  },
});
