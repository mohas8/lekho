import { defineConfig } from '@playwright/test';

export const FIXTURE_PORT = 4173;

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx tsx scripts/fixtures-server.ts --port ${FIXTURE_PORT}`,
    url: `http://localhost:${FIXTURE_PORT}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
