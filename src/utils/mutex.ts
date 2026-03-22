/**
 * A simple async mutex to handle sequential execution within 
 * a parallel batch.
 */
export class Mutex {
  private queue: Promise<any> = Promise.resolve();

  async run<T>(action: () => T | Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      return await action();
    });
    this.queue = next.catch(() => {}); // prevent chain breakage
    return await next;
  }
}
