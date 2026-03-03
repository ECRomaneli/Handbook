import EventEmitter from 'node:events';

/**
 * Parasite function type - called for each method invocation
 */
type ParasiteFunction = (methodName: string, args: IArguments) => void;

/**
 * Object with prototype methods
 */
type ObjectWithMethods = Record<string, unknown> & { __proto__: Record<string, unknown> };

/**
 * Wraps all methods of an object to call a parasite function before the original method.
 * Useful for debugging and tracing method calls.
 * @param obj Object to parasite
 * @param parasiteFn Function to call before each method invocation
 * @param printMethods Whether to print the list of methods to console
 */
export function parasiteIt(obj: ObjectWithMethods, parasiteFn: ParasiteFunction, printMethods?: boolean): void {
  const methods: string[] = [];
  for (const prop in obj.__proto__) {
    if (typeof obj[prop] === 'function') {
      methods.push(prop);
    }
  }

  console.debug('Trying to parasite obj...');
  if (printMethods) {
    console.debug(methods);
  }

  methods.forEach((methodName) => {
    const originalMethod = obj[methodName] as (...args: unknown[]) => unknown;
    obj[methodName] = function (this: unknown, ...args: unknown[]): unknown {
      // eslint-disable-next-line prefer-rest-params
      parasiteFn(methodName, arguments);
      return originalMethod.call(obj, ...args);
    };
  });
}

export function logEmit(emitter: EventEmitter, name = 'Event'): void {
  emitter.emit = ((originalEmit) => (eventName: string, ...args: unknown[]) => {
    console.debug(`${name}:`, eventName);
    return originalEmit.call(emitter, eventName, ...args);
  })(emitter.emit);
}
