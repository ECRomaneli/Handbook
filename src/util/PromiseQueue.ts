/**
 * A queue that executes promises sequentially, ensuring each task
 * completes before the next one starts.
 */
class PromiseQueue {
  #currentTask: Promise<unknown> = Promise.resolve();

  /**
   * Queues a function to be executed after previous tasks complete
   * @param promiseFn Function that returns a promise
   * @returns Promise that resolves with the function's result
   */
  add<T>(promiseFn: () => Promise<T>): Promise<T> {
    const task = this.#currentTask;
    return (this.#currentTask = new Promise<T>((resolve, reject) => {
      task.finally(() => {
        try {
          promiseFn().then(resolve).catch(reject);
        } catch (e) {
          reject(e);
        }
      });
    }));
  }
}

export default PromiseQueue;
