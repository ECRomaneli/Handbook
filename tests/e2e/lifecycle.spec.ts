/**
 * Phase 2 — Main Process E2E Lifecycle
 *
 * Boots the real Electron app via `_electron.launch`, then uses
 * `electronApp.evaluate()` to reach into the Main Process and assert that
 * the core singletons (`FrameService`, `AppState`) initialised correctly.
 *
 * All evaluate() callbacks access singletons via the `globalThis.__handbook`
 * bridge exposed by Bootstrap when HANDBOOK_E2E=1.
 */
import { ElectronApplication, expect, test } from '@playwright/test';
import { launchApp, seedTestPage } from './helpers/launch';

let app: ElectronApplication;

test.beforeAll(async () => {
  app = await launchApp();
  await seedTestPage(app);
});
test.afterAll(async () => { await app?.close(); });

// ── Frame existence ──────────────────────────────────────────────────────────

test.describe('App Bootstrap & Frame Assembly', () => {

  test('FrameService.getFrame() returns a live BaseWindow', async () => {
    const result = await app.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hb = (globalThis as any).__handbook;
      const frame = hb.FrameService.getFrame();
      if (!frame) return { exists: false, destroyed: true };
      return { exists: true, destroyed: frame.isDestroyed() };
    });

    expect(result.exists).toBe(true);
    expect(result.destroyed).toBe(false);
  });

  test('AppState.pages is initialised as an array', async () => {
    const result = await app.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hb = (globalThis as any).__handbook;
      return { isArray: Array.isArray(hb.AppState.pages), length: hb.AppState.pages.length };
    });

    expect(result.isArray).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  test('AppState.frame references the same BaseWindow as FrameService', async () => {
    const same = await app.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hb = (globalThis as any).__handbook;
      return hb.AppState.frame === hb.FrameService.getFrame();
    });

    expect(same).toBe(true);
  });

  test('Tray is created during bootstrap', async () => {
    const hasTray = await app.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hb = (globalThis as any).__handbook;
      return hb.AppState.tray !== undefined;
    });

    expect(hasTray).toBe(true);
  });
});
