/**
 * Phase 3 — IPC & View Orchestration via Propagators
 *
 * Instead of clicking DOM elements we reach into the Main Process through
 * `electronApp.evaluate()` and interact with the Propagator singletons
 * directly — the same path real IPC messages travel.
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

// ── Navbar Propagator ────────────────────────────────────────────────────────

test.describe('Navbar Propagator actions', () => {

  test('emitting render:toggle-mute toggles the active view mute state', async () => {
    const result = await app.evaluate(() => new Promise<{ toggled: boolean }>((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hb = (globalThis as any).__handbook;
      const view = hb.ViewService.getCurrentView();
      if (!view) return { skipped: true };

      const wasMuted = view.webContents.isAudioMuted();

      // Wait for the status change
      hb.ViewPropagator.once('mute-status-changed', () => {
        const isMuted = view.webContents.isAudioMuted();
        // Restore original state
        view.webContents.setAudioMuted(wasMuted);

        resolve({ toggled: wasMuted !== isMuted });
      });

      // Simulate the IPC event the navbar renderer would send
      hb.NavbarPropagator.emit('render:toggle-mute');
    }));
    expect(result.toggled).toBe(true);
  });

  test('emitting render:back fires without throwing', async () => {
    const result = await app.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hb = (globalThis as any).__handbook;
      const view = hb.ViewService.getCurrentView();
      if (!view) return { skipped: true };

      try {
        hb.NavbarPropagator.emit('render:back');
        return { skipped: false, fired: true };
      } catch {
        return { skipped: false, fired: false };
      }
    });

    if (result.skipped) {
      test.skip();
      return;
    }
    expect(result.fired).toBe(true);
  });
});

// ── View Propagator ──────────────────────────────────────────────────────────

test.describe('ViewPropagator event routing', () => {

  test('mute-status-changed event is emitted when mute toggles', async () => {
    const result = await app.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hb = (globalThis as any).__handbook;
      const view = hb.ViewService.getCurrentView();
      if (!view) return { skipped: true };

      let eventFired = false;
      const listener = () => { eventFired = true; };

      hb.ViewPropagator.on('mute-status-changed', listener);

      const wasMuted = view.webContents.isAudioMuted();
      view.webContents.setAudioMuted(!wasMuted);
      view.webContents.emit('mute-status-changed');

      await new Promise((r) => setTimeout(r, 50));

      hb.ViewPropagator.off('mute-status-changed', listener);
      view.webContents.setAudioMuted(wasMuted);

      return { skipped: false, eventFired };
    });

    if (result.skipped) {
      test.skip();
      return;
    }
    expect(result.eventFired).toBe(true);
  });
});

// ── Preferences Propagator → Storage round-trip ──────────────────────────────

test.describe('PreferencesPropagator settings round-trip', () => {

  test('render:settings-updated writes to Storage and can be read back', async () => {
    const result = await app.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hb = (globalThis as any).__handbook;

      const key = 'blur_opacity';
      const original = hb.Storage.getSettings(key);
      const testValue = original === 50 ? 60 : 50;

      hb.PreferencesPropagator.emit('render:settings-updated', { sender: {} }, key, testValue);

      await new Promise((r) => setTimeout(r, 50));

      const stored = hb.Storage.getSettings(key);

      // Restore
      hb.Storage.setSettings(key, original);

      return { original, testValue, stored, matches: stored === testValue };
    });

    expect(result.matches).toBe(true);
  });
});
