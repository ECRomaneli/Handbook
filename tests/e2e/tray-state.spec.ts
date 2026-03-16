/**
 * Phase 4 — OS Integrations: Tray & StatePropagator
 *
 * Exercises `TrayPropagator` and `StatePropagator` by emitting events from
 * within the Main Process and asserting the expected side-effects occur
 * (e.g. frame visibility toggle, `state:change` fires).
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

// ── Tray click → toggle visibility ──────────────────────────────────────────

test.describe('TrayPropagator', () => {

  test('emitting tray:click toggles Frame visibility', async () => {
    const result = await app.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hb = (globalThis as any).__handbook;
      const frame = hb.FrameService.getFrame();
      if (!frame) return { skipped: true };

      const wasVisible = frame.isVisible();

      hb.TrayPropagator.emit('click');
      await new Promise((r) => setTimeout(r, 200));

      const isVisible = frame.isDestroyed() ? false : frame.isVisible();

      return { skipped: false, wasVisible, isVisible, toggled: wasVisible !== isVisible };
    });

    if (result.skipped) {
      test.skip();
      return;
    }
    expect(result.toggled).toBe(true);
  });

  test('double tray:click returns Frame to original visibility', async () => {
    const result = await app.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hb = (globalThis as any).__handbook;
      const frame = hb.FrameService.getFrame();
      if (!frame) return { skipped: true };

      const original = frame.isVisible();

      hb.TrayPropagator.emit('click');
      await new Promise((r) => setTimeout(r, 200));
      hb.TrayPropagator.emit('click');
      await new Promise((r) => setTimeout(r, 200));

      const final = frame.isDestroyed() ? false : frame.isVisible();
      return { skipped: false, original, final, restored: original === final };
    });

    if (result.skipped) {
      test.skip();
      return;
    }
    expect(result.restored).toBe(true);
  });
});

// ── StatePropagator ─────────────────────────────────────────────────────────

test.describe('StatePropagator', () => {

  test('state:change fires when Frame shows/hides', async () => {
    const result = await app.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hb = (globalThis as any).__handbook;
      const frame = hb.FrameService.getFrame();
      if (!frame) return { skipped: true };

      // Ensure a known starting state: frame visible
      if (!frame.isVisible()) {
        frame.show();
        await new Promise((r) => setTimeout(r, 300));
      }

      const events: string[] = [];
      const listener = (name: string) => { events.push(name); };
      hb.StatePropagator.onChange(listener);

      frame.hide();
      await new Promise((r) => setTimeout(r, 300));
      frame.show();
      await new Promise((r) => setTimeout(r, 300));

      hb.StatePropagator.off('change', listener);

      return { skipped: false, events, count: events.length };
    });

    if (result.skipped) {
      test.skip();
      return;
    }
    expect(result.count).toBeGreaterThanOrEqual(1);
    for (const e of result.events ?? []) {
      expect(['show', 'hide']).toContain(e);
    }
  });

  test('state:change fires on view attach', async () => {
    const result = await app.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hb = (globalThis as any).__handbook;
      const view = hb.ViewService.getCurrentView();
      if (!view) return { skipped: true };

      let attachedFired = false;
      const listener = (name: string) => {
        if (name === 'attached') attachedFired = true;
      };

      hb.StatePropagator.onChange(listener);

      hb.ViewPropagator.emit('attached', view.webContents);

      await new Promise((r) => setTimeout(r, 100));
      hb.StatePropagator.off('change', listener);

      return { skipped: false, attachedFired };
    });

    if (result.skipped) {
      test.skip();
      return;
    }
    expect(result.attachedFired).toBe(true);
  });
});
