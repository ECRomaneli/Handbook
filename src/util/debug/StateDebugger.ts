export type SnapshotRow = {
  attribute: string;
  exists: 'true' | false;
  status: string | number | boolean;
};

export type TrackerType<T> =
  | 'bool'
  | 'destroyable'
  | 'closable'
  | 'array'
  | 'string'
  | 'number'
  | ((current: T | undefined, previous: T | undefined) => string | number | boolean);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TrackerEntry<T = any> = {
  name: string;
  provider: () => T;
  type?: TrackerType<T>;
};

export class StateDebugger {
  static start(
    trackers: TrackerEntry[],
    intervalMs = 1000,
    logAll = false,
    logFn: (rows: SnapshotRow[]) => void = console.table,
  ): () => void {
    const previousValues = new Map<string, unknown>();
    let previousRows = StateDebugger.snapshot(trackers, previousValues);
    let previousMap = StateDebugger.toMap(previousRows);

    const timer = setInterval(() => {
      const currentRows = StateDebugger.snapshot(trackers, previousValues);
      const currentMap = StateDebugger.toMap(currentRows);

      const changed = logAll
        ? currentRows
        : currentRows.filter((row) => {
          const prev = previousMap.get(row.attribute);
          return !prev || prev.exists !== row.exists || prev.status !== row.status;
        });

      if (changed.length > 0) logFn(changed);

      previousRows = currentRows;
      previousMap = currentMap;
    }, intervalMs);

    return () => clearInterval(timer);
  }

  private static snapshot(trackers: TrackerEntry[], previousValues: Map<string, unknown>): SnapshotRow[] {
    return trackers.map(({ name, provider, type }) => {
      const currentValue = provider();
      const status = StateDebugger.describe(type, previousValues.get(name), currentValue);
      previousValues.set(name, currentValue);
      return {
        attribute: name,
        exists: currentValue !== undefined ? 'true' : false,
        status,
      };
    });
  }

  private static describe(
    type: TrackerType<unknown> | undefined,
    previousValue: unknown | undefined,
    currentValue: unknown,
  ): string | number | boolean {
    if (type && typeof type === 'function') {
      return type(currentValue, previousValue);
    }

    if (currentValue === undefined || currentValue === null) return '';

    switch (type) {
      case 'bool':
        return Boolean(currentValue);
      case 'string':
        return typeof currentValue === 'string' ? currentValue : '';
      case 'number':
        return typeof currentValue === 'number' ? currentValue : '';
      case 'array':
        return Array.isArray(currentValue) ? `count: ${currentValue.length}` : '';
      case 'destroyable':
        return StateDebugger.lifecycle(currentValue, 'destroyed', 'alive');
      case 'closable':
        return StateDebugger.lifecycle(currentValue, 'closed', 'open');
      default:
        // Fallback to type inference
        if (typeof currentValue === 'boolean') return currentValue;
        if (typeof currentValue === 'string' || typeof currentValue === 'number') return currentValue;
        if (Array.isArray(currentValue)) return `count: ${currentValue.length}`;
        return StateDebugger.lifecycle(currentValue, 'destroyed', 'alive');
    }
  }

  private static lifecycle(value: unknown, negative: string, positive: string): string {
    // eslint-disable-next-line @stylistic/max-len
    const maybe = value as { isDestroyed?: () => boolean; isClosed?: () => boolean; destroyed?: boolean; closed?: boolean };

    if (typeof maybe.isDestroyed === 'function') {
      return maybe.isDestroyed() ? negative : positive;
    }

    if (typeof maybe.isClosed === 'function') {
      return maybe.isClosed() ? negative : positive;
    }

    if (typeof maybe.destroyed === 'boolean') {
      return maybe.destroyed ? negative : positive;
    }

    if (typeof maybe.closed === 'boolean') {
      return maybe.closed ? negative : positive;
    }

    return '';
  }

  private static toMap(rows: SnapshotRow[]) {
    return new Map(rows.map((r) => [r.attribute, r]));
  }
}
