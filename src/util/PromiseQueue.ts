/**
 * A queue that executes promises sequentially, ensuring each task
 * completes before the next one starts.
 */
class PromiseQueue {
  private static readonly EMPTY_HANDLER = () => { };
  private queue: Promise<void> = Promise.resolve();

  /**
   * Queues a function to be executed after previous tasks complete
   * @param promiseFn Function that returns a promise
   * @returns Promise that resolves with the function's result
   */
  push<T>(promiseFn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(promiseFn);
    this.queue = result.then(PromiseQueue.EMPTY_HANDLER, PromiseQueue.EMPTY_HANDLER);
    return result;
  }
}

export default PromiseQueue;
