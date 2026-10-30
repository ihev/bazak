import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const apiPort = process.env.E2E_API_PORT ?? '39101';
const webPort = process.env.E2E_WEB_PORT ?? '39102';
const baseURL = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15000,
  globalTimeout: 120000,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node apps/api/.test-build/support/e2e-server.js',
      env: { E2E_API_PORT: apiPort },
      url: `http://127.0.0.1:${apiPort}/api/health`,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 1000 },
    },
    {
      command: 'node node_modules/vite/bin/vite.js',
      cwd: resolve(__dirname, 'apps/web'),
      env: { API_HOST: '127.0.0.1', API_PORT: apiPort, WEB_PORT: webPort },
      url: baseURL,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 1000 },
    },
  ],
});
