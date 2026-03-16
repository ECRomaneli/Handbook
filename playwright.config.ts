import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: 'tests/e2e/global-setup.ts',
  timeout: 60_000,
  retries: 0,
  workers: 1, // Electron tests must run serially
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
});
