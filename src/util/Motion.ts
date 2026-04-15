type MotionCallback = (value: number) => void;

type MotionCancelReason = 'cancelled' | 'replaced';

class MotionCancelledError extends Error {
  public readonly reason: MotionCancelReason;

  constructor(reason: MotionCancelReason) {
    super(`Animation ${reason}`);
    this.reason = reason;
  }
}

type EasingEffect =
  | 'linear'
  | 'ease-in' | 'ease-out' | 'ease-in-out'
  | 'ease-in-quad' | 'ease-out-quad' | 'ease-in-out-quad'
  | 'ease-in-cubic' | 'ease-out-cubic' | 'ease-in-out-cubic'
  | 'ease-in-quart' | 'ease-out-quart' | 'ease-in-out-quart'
  | 'ease-in-expo' | 'ease-out-expo' | 'ease-in-out-expo'
  | 'ease-in-circ' | 'ease-out-circ' | 'ease-in-out-circ'
  | 'ease-in-back' | 'ease-out-back' | 'ease-in-out-back'
  | 'ease-in-elastic' | 'ease-out-elastic' | 'ease-in-out-elastic'
  | 'ease-in-bounce' | 'ease-out-bounce' | 'ease-in-out-bounce';

interface MotionOptions {
  id?: string;
  effect?: EasingEffect;
  duration?: number;
  range?: [number, number];
  fps?: number;
}

type EasingFn = (t: number) => number;

const EASING: Record<EasingEffect, EasingFn> = {
  'linear': (t) => t,

  // Sine (default ease)
  'ease-in': (t) => 1 - Math.cos((t * Math.PI) / 2),
  'ease-out': (t) => Math.sin((t * Math.PI) / 2),
  'ease-in-out': (t) => -(Math.cos(Math.PI * t) - 1) / 2,

  // Quad
  'ease-in-quad': (t) => t * t,
  'ease-out-quad': (t) => t * (2 - t),
  'ease-in-out-quad': (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  // Cubic
  'ease-in-cubic': (t) => t * t * t,
  'ease-out-cubic': (t) => (--t) * t * t + 1,
  'ease-in-out-cubic': (t) => t < 0.5 ? 4 * t * t * t : 1 + (--t) * 2 * (2 * t * t),

  // Quart
  'ease-in-quart': (t) => t * t * t * t,
  'ease-out-quart': (t) => 1 - (--t) * t * t * t,
  'ease-in-out-quart': (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,

  // Expo
  'ease-in-expo': (t) => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  'ease-out-expo': (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  'ease-in-out-expo': (t) => {
    if (t === 0 || t === 1) { return t; }
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },

  // Circ
  'ease-in-circ': (t) => 1 - Math.sqrt(1 - t * t),
  'ease-out-circ': (t) => Math.sqrt(1 - (--t) * t),
  'ease-in-out-circ': (t) => t < 0.5
    ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
    : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2,

  // Back (overshoot)
  'ease-in-back': (t) => { const c = 1.70158; return t * t * ((c + 1) * t - c); },
  'ease-out-back': (t) => { const c = 1.70158; return 1 + (--t) * t * ((c + 1) * t + c); },
  'ease-in-out-back': (t) => {
    const c = 1.70158 * 1.525;
    return t < 0.5
      ? (2 * t) ** 2 * ((c + 1) * 2 * t - c) / 2
      : ((2 * t - 2) ** 2 * ((c + 1) * (2 * t - 2) + c) + 2) / 2;
  },

  // Elastic
  'ease-in-elastic': (t) => {
    if (t === 0 || t === 1) { return t; }
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3));
  },
  'ease-out-elastic': (t) => {
    if (t === 0 || t === 1) { return t; }
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  'ease-in-out-elastic': (t) => {
    if (t === 0 || t === 1) { return t; }
    const p = (2 * Math.PI) / 4.5;
    return t < 0.5
      ? -Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * p) / 2
      : Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * p) / 2 + 1;
  },

  // Bounce
  'ease-out-bounce': (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) { return n * t * t; }
    if (t < 2 / d) { return n * (t -= 1.5 / d) * t + 0.75; }
    if (t < 2.5 / d) { return n * (t -= 2.25 / d) * t + 0.9375; }
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  'ease-in-bounce': (t) => 1 - EASING['ease-out-bounce'](1 - t),
  'ease-in-out-bounce': (t) => t < 0.5
    ? (1 - EASING['ease-out-bounce'](1 - 2 * t)) / 2
    : (1 + EASING['ease-out-bounce'](2 * t - 1)) / 2,
};

class Motion {
  private static readonly running = new Map<string, (reason: MotionCancelReason) => void>();

  public static animate(callback: MotionCallback, options: MotionOptions = {}): Promise<void> {
    const { id, effect = 'ease-in-out', duration = 300, range = [0, 1], fps } = options;
    const [from, to] = range;
    const delta = to - from;
    const easingFn = EASING[effect];
    const frameInterval = fps ? 1000 / fps : 0;

    if (id) { this.cancel(id, 'replaced'); }

    if (!duration || !delta) {
      callback(to);
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      let animationId: ReturnType<typeof requestAnimationFrame>;
      let cancelled = false;
      let lastFrameTime = performance.now();

      const cancel = (reason: MotionCancelReason) => {
        cancelled = true;
        cancelAnimationFrame(animationId);
        id && this.running.delete(id);
        reject(new MotionCancelledError(reason));
      };

      if (id) { this.running.set(id, cancel); }

      const start = performance.now();

      const step = (now: number) => {
        if (cancelled) { return; }

        if (frameInterval && now - lastFrameTime < frameInterval) {
          animationId = requestAnimationFrame(step);
          return;
        }

        lastFrameTime = now;
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);

        try {
          if (progress >= 1) {
            callback(to);
            id && this.running.delete(id);
            resolve();
          } else {
            callback(from + delta * easingFn(progress));
            animationId = requestAnimationFrame(step);
          }
        } catch (error) {
          cancelled = true;
          cancelAnimationFrame(animationId);
          id && this.running.delete(id);
          reject(error);
        }
      };

      animationId = requestAnimationFrame(step);
    });
  }

  public static cancel(id: string, reason: MotionCancelReason = 'cancelled'): void {
    this.running.get(id)?.(reason);
  }

  public static cancelAll(reason: MotionCancelReason = 'cancelled'): void {
    this.running.forEach((cancel) => cancel(reason));
    this.running.clear();
  }
}

export { MotionCancelledError };
export default Motion;
