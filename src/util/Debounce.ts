/**
 * Debounced function type
 */
type DebouncedFunction = (/*...args: unknown[]*/) => void;

/**
 * Returns a listener that always cancel the previous call during the cancel timeout.
 * @param listener Listener to be wrapped.
 * @param cancelTimeout time on which the listener can be canceled.
 * @returns Cancelable listener.
 */
function debounce(listener: (/*...args: unknown[]*/) => void, cancelTimeout: number): DebouncedFunction {
  let timerId: NodeJS.Timeout | undefined;
  return (/*...e: unknown[]*/): void => {
    clearTimeout(timerId);
    timerId = setTimeout(() => { listener(/*...e*/); }, cancelTimeout);
  };
}

export default debounce;
