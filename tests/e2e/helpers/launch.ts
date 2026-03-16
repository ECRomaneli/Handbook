/**
 * Shared helpers for Playwright Electron E2E tests.
 *
 * Every suite calls `launchApp()` in beforeAll and `app.close()` in afterAll.
 * The app is pre-built by `global-setup.ts`, so this helper only launches.
 *
 * A temporary `--user-data-dir` is used to avoid colliding with a live
 * instance's single-instance lock and to keep test state isolated.
 *
 * `seedTestPage()` injects a minimal page into the empty test profile so
 * the Frame and View are created (otherwise the app just shows the tray).
 */
import { _electron, type ElectronApplication } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export function launchApp(): Promise<ElectronApplication> {
  const root = path.resolve(__dirname, '../../..');
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'handbook-e2e-'));

  return _electron.launch({
    args: [
      '--no-sandbox',
      `--user-data-dir=${userDataDir}`,
      '.',
    ],
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      HANDBOOK_E2E: '1',
    },
    timeout: 30_000,
  });
}

/**
 * Wait for the `globalThis.__handbook` bridge that Bootstrap exposes when
 * HANDBOOK_E2E=1.  The bridge is set at the very end of Bootstrap.initialize()
 * which runs in a whenReady().then() microtask — Playwright may resolve
 * _electron.launch() before that microtask completes.
 */
async function waitForBridge(app: ElectronApplication, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ready = await app.evaluate(() => !!(globalThis as Record<string, unknown>).__handbook);
    if (ready) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error('Test bridge not found after timeout — is HANDBOOK_E2E=1?');
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Seed a test page into a freshly-launched app so that the Frame and View
 * are created and available for testing.  Call once after `launchApp()`.
 */
export async function seedTestPage(app: ElectronApplication): Promise<void> {
  await waitForBridge(app);

  await app.evaluate(() => new Promise<void>((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hb = (globalThis as any).__handbook;
    if (hb.AppState.pages.length > 0) return;

    // Write a test page into storage, reload pages, and trigger frame creation
    hb.Storage.setPages([{ id: 'e2e-test', label: 'E2E Test', url: 'data:text/html,<h1>E2E</h1>' }]);
    hb.PageService.updatePages();

    hb.ViewPropagator.onceCurrentView('did-stop-loading', r);
    hb.PageService.setupOrTogglePage();
  }));
}

