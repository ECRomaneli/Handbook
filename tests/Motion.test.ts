import Motion, { MotionCancelledError } from '@/util/Motion';

// ─── Mock requestAnimationFrame / cancelAnimationFrame / performance.now ───

let rafCallbacks: Map<number, FrameRequestCallback>;
let rafIdCounter: number;
let currentTime: number;

function mockRAF() {
  rafCallbacks = new Map();
  rafIdCounter = 0;
  currentTime = 0;

  (global as any).performance = { now: () => currentTime };

  (global as any).requestAnimationFrame = (cb: FrameRequestCallback): number => {
    const id = ++rafIdCounter;
    rafCallbacks.set(id, cb);
    return id;
  };

  (global as any).cancelAnimationFrame = (id: number): void => {
    rafCallbacks.delete(id);
  };
}

function advanceFrames(count: number, frameDuration = 16.67) {
  for (let i = 0; i < count; i++) {
    currentTime += frameDuration;
    const callbacks = [...rafCallbacks.entries()];
    rafCallbacks.clear();
    callbacks.forEach(([, cb]) => cb(currentTime));
  }
}

function advanceToEnd(duration: number, frameDuration = 16.67) {
  const frames = Math.ceil(duration / frameDuration) + 2;
  advanceFrames(frames, frameDuration);
}

// ─── Tests ──────────────────────────────────────────────────────────

/** Swallow rejection so the promise doesn't crash the process. */
const ignoreRejection = (p: Promise<void>) => { p.catch(() => { }); return p; };

beforeEach(() => {
  mockRAF();
});

describe('Motion', () => {

  // ─── Basic animation ──────────────────────────────────────────────

  describe('basic animation', () => {
    test('should call callback with values in range [0, 100]', () => {
      const values: number[] = [];
      ignoreRejection(Motion.animate((v) => values.push(v), {
        effect: 'linear', duration: 100, range: [0, 100],
      }));

      advanceToEnd(100);

      expect(values.length).toBeGreaterThan(1);
      expect(values[values.length - 1]).toBe(100);
      values.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      });
    });

    test('should resolve promise on completion', async () => {
      const promise = Motion.animate(() => { }, {
        effect: 'linear', duration: 100, range: [0, 1],
      });

      advanceToEnd(100);

      await expect(promise).resolves.toBeUndefined();
    });

    test('should use default options when none provided', () => {
      const values: number[] = [];
      ignoreRejection(Motion.animate((v) => values.push(v)));

      advanceToEnd(300);

      expect(values.length).toBeGreaterThan(0);
      expect(values[values.length - 1]).toBe(1);
    });
  });

  // ─── Final value precision ────────────────────────────────────────

  describe('final value precision', () => {
    test('should deliver exact final value (not easing-approximated)', () => {
      let lastValue = -1;
      ignoreRejection(Motion.animate((v) => (lastValue = v), {
        effect: 'ease-in', duration: 100, range: [0, 400],
      }));

      advanceToEnd(100);

      expect(lastValue).toBe(400);
    });

    test('should deliver exact final value for decreasing range', () => {
      let lastValue = -1;
      ignoreRejection(Motion.animate((v) => (lastValue = v), {
        effect: 'ease-out', duration: 100, range: [400, 0],
      }));

      advanceToEnd(100);

      expect(lastValue).toBe(0);
    });
  });

  // ─── Decreasing range ────────────────────────────────────────────

  describe('decreasing range', () => {
    test('should animate from high to low', () => {
      const values: number[] = [];
      ignoreRejection(Motion.animate((v) => values.push(v), {
        effect: 'linear', duration: 100, range: [100, 0],
      }));

      advanceToEnd(100);

      expect(values[0]).toBeLessThan(100);
      expect(values[0]).toBeGreaterThan(0);
      expect(values[values.length - 1]).toBe(0);
    });
  });

  // ─── Zero duration ───────────────────────────────────────────────

  describe('zero/edge duration', () => {
    test('should immediately call callback with final value when duration is 0', () => {
      let value = -1;
      Motion.animate((v) => (value = v), {
        duration: 0, range: [0, 100],
      });

      expect(value).toBe(100);
    });

    test('should resolve immediately when duration is 0', async () => {
      const promise = Motion.animate(() => { }, { duration: 0, range: [0, 1] });
      await expect(promise).resolves.toBeUndefined();
    });
  });

  // ─── Zero delta (same from/to) ───────────────────────────────────

  describe('zero delta', () => {
    test('should immediately call callback with final value when range has no delta', () => {
      let value = -1;
      Motion.animate((v) => (value = v), {
        duration: 1000, range: [50, 50],
      });

      expect(value).toBe(50);
    });

    test('should resolve immediately when range has no delta', async () => {
      const promise = Motion.animate(() => { }, { duration: 1000, range: [50, 50] });
      await expect(promise).resolves.toBeUndefined();
    });
  });

  // ─── Cancel by ID ────────────────────────────────────────────────

  describe('cancel by id', () => {
    test('should reject with MotionCancelledError reason "cancelled"', async () => {
      const promise = Motion.animate(() => { }, {
        id: 'test', duration: 1000, range: [0, 100],
      });

      advanceFrames(2);
      Motion.cancel('test');

      await expect(promise).rejects.toThrow(MotionCancelledError);
      await promise.catch((err: MotionCancelledError) => {
        expect(err.reason).toBe('cancelled');
      });
    });

    test('should stop calling callback after cancel', () => {
      let callCount = 0;
      ignoreRejection(Motion.animate(() => { callCount++; }, {
        id: 'test', duration: 1000, range: [0, 100],
      }));

      advanceFrames(3);
      const countAtCancel = callCount;
      Motion.cancel('test');
      advanceFrames(10);

      expect(callCount).toBe(countAtCancel);
    });
  });

  // ─── Cancel all ──────────────────────────────────────────────────

  describe('cancelAll', () => {
    test('should cancel all running animations', async () => {
      const p1 = Motion.animate(() => { }, { id: 'a', duration: 1000, range: [0, 1] });
      const p2 = Motion.animate(() => { }, { id: 'b', duration: 1000, range: [0, 1] });

      advanceFrames(2);
      Motion.cancelAll();

      await expect(p1).rejects.toThrow(MotionCancelledError);
      await expect(p2).rejects.toThrow(MotionCancelledError);
    });
  });

  // ─── Replaced by same ID ─────────────────────────────────────────

  describe('replaced by same id', () => {
    test('should reject old animation with reason "replaced"', async () => {
      const oldPromise = Motion.animate(() => { }, {
        id: 'dup', duration: 1000, range: [0, 100],
      });

      advanceFrames(2);

      // Start new animation with same id
      ignoreRejection(Motion.animate(() => { }, {
        id: 'dup', duration: 1000, range: [0, 100],
      }));

      await expect(oldPromise).rejects.toThrow(MotionCancelledError);
      await oldPromise.catch((err: MotionCancelledError) => {
        expect(err.reason).toBe('replaced');
      });
    });

    test('new animation should still complete after replacing', async () => {
      ignoreRejection(Motion.animate(() => { }, { id: 'dup', duration: 1000, range: [0, 1] }));
      advanceFrames(2);

      const newPromise = Motion.animate(() => { }, {
        id: 'dup', duration: 100, range: [0, 1],
      });

      advanceToEnd(100);

      await expect(newPromise).resolves.toBeUndefined();
    });
  });

  // ─── Callback exception ──────────────────────────────────────────

  describe('callback exception', () => {
    test('should reject with the thrown error', async () => {
      const error = new Error('callback failed');
      let callCount = 0;

      const promise = Motion.animate(() => {
        callCount++;
        if (callCount === 3) { throw error; }
      }, {
        id: 'err', duration: 1000, range: [0, 100],
      });

      advanceFrames(5);

      await expect(promise).rejects.toThrow('callback failed');
      await promise.catch((err) => {
        expect(err).toBe(error);
        expect(err).not.toBeInstanceOf(MotionCancelledError);
      });
    });

    test('should stop animation after callback throws', () => {
      let callCount = 0;

      ignoreRejection(Motion.animate(() => {
        callCount++;
        if (callCount === 2) { throw new Error('stop'); }
      }, {
        id: 'err2', duration: 1000, range: [0, 100],
      }));

      advanceFrames(10);

      expect(callCount).toBe(2);
    });
  });

  // ─── FPS limiting ────────────────────────────────────────────────

  describe('fps limiting', () => {
    test('should reduce number of callback invocations with low fps', () => {
      let unlimitedCount = 0;
      let limitedCount = 0;

      ignoreRejection(Motion.animate(() => { unlimitedCount++; }, {
        id: 'unlimited', duration: 200, range: [0, 1],
      }));

      ignoreRejection(Motion.animate(() => { limitedCount++; }, {
        id: 'limited', duration: 200, range: [0, 1], fps: 10,
      }));

      advanceToEnd(200);

      expect(unlimitedCount).toBeGreaterThan(limitedCount);
    });
  });

  // ─── All easing effects ──────────────────────────────────────────

  describe('easing effects', () => {
    const effects: string[] = [
      'linear',
      'ease-in', 'ease-out', 'ease-in-out',
      'ease-in-quad', 'ease-out-quad', 'ease-in-out-quad',
      'ease-in-cubic', 'ease-out-cubic', 'ease-in-out-cubic',
      'ease-in-quart', 'ease-out-quart', 'ease-in-out-quart',
      'ease-in-expo', 'ease-out-expo', 'ease-in-out-expo',
      'ease-in-circ', 'ease-out-circ', 'ease-in-out-circ',
      'ease-in-back', 'ease-out-back', 'ease-in-out-back',
      'ease-in-elastic', 'ease-out-elastic', 'ease-in-out-elastic',
      'ease-in-bounce', 'ease-out-bounce', 'ease-in-out-bounce',
    ];

    test.each(effects)('%s should complete and deliver exact final value', (effect) => {
      let lastValue = -1;
      ignoreRejection(Motion.animate((v) => (lastValue = v), {
        effect: effect as any, duration: 100, range: [0, 100],
      }));

      advanceToEnd(100);

      expect(lastValue).toBe(100);
    });
  });

  // ─── No ID animations ────────────────────────────────────────────

  describe('animations without id', () => {
    test('should not be cancellable by id', () => {
      let callCount = 0;
      ignoreRejection(Motion.animate(() => { callCount++; }, {
        duration: 100, range: [0, 1],
      }));

      advanceFrames(2);
      const countBefore = callCount;
      Motion.cancel('nonexistent');
      advanceFrames(2);

      expect(callCount).toBeGreaterThan(countBefore);
    });

    test('multiple no-id animations should run independently', async () => {
      let v1 = -1, v2 = -1;

      const p1 = Motion.animate((v) => (v1 = v), {
        effect: 'linear', duration: 100, range: [0, 50],
      });
      const p2 = Motion.animate((v) => (v2 = v), {
        effect: 'linear', duration: 100, range: [0, 200],
      });

      advanceToEnd(100);

      await expect(p1).resolves.toBeUndefined();
      await expect(p2).resolves.toBeUndefined();
      expect(v1).toBe(50);
      expect(v2).toBe(200);
    });
  });
});
