import { Mutex } from './mutex';

/**
 * A synchronization barrier that allows multiple parallel row processors
 * to coordinate their navigation actions.
 */
type BarrierWaiter = {
  resolve: (v: any) => void;
  reject: (e: any) => void;
  moveAction?: () => Promise<any>;
};

export class NavigationBarrier {
  private total: number;
  private finishedCount = 0;
  private buckets: Map<number, Set<BarrierWaiter>> = new Map();
  private recoveryMutex: Mutex | null = null;

  constructor(total: number) {
    this.total = total;
  }

  /** True when more than one row shares this barrier (scrollToRow would evict peers). */
  isParallel(): boolean {
    return this.total > 1;
  }

  /**
   * Synchronize all active rows at a specific column index.
   * The last row to arrive will trigger the `moveAction`.
   */
  async sync<T = void>(colIndex: number, moveAction?: () => Promise<T>): Promise<T | void> {
    if (this.total <= 1) {
      if (moveAction) return await moveAction();
      return;
    }

    return new Promise((resolve, reject) => {
      let bucket = this.buckets.get(colIndex);
      if (!bucket) {
        bucket = new Set();
        this.buckets.set(colIndex, bucket);
      }
      bucket.add({ resolve, reject, moveAction });

      if (bucket.size + this.finishedCount >= this.total) {
        (async () => {
          let result: T | undefined;
          let err: unknown;
          try {
            // Find the first waiter that supplied a moveAction — the last arrival may be
            // a no-op (fast-path) row with no action, but an earlier waiter's action must
            // still run, otherwise the column scroll is silently skipped.
            const action = (Array.from(bucket).find(w => w.moveAction)?.moveAction) as (() => Promise<T>) | undefined;
            if (action) result = await action();
          } catch (e) {
            err = e;
          } finally {
            if (err !== undefined) {
              this.broadcastError(colIndex, err);
            } else {
              this.broadcast(colIndex, result);
            }
          }
        })();
      }
    });
  }

  /**
   * Mark a row as finished (no more cells to process).
   * This ensures the barrier doesn't wait for rows that have exited the loop.
   */
  markFinished(): void {
    this.finishedCount++;
    for (const colIndex of Array.from(this.buckets.keys())) {
      const bucket = this.buckets.get(colIndex)!;
      if (bucket.size + this.finishedCount >= this.total) {
        this.broadcast(colIndex);
      }
    }
  }

  private broadcast(colIndex: number, result?: any) {
    const bucket = this.buckets.get(colIndex);
    if (bucket) {
      for (const { resolve } of bucket) resolve(result);
      this.buckets.delete(colIndex);
    }
  }

  /**
   * Run a recovery action exclusively — serialized so concurrent rows don't race
   * on scrollTop after a horizontal scroll evicts rows from the vertical viewport.
   * The fn receives a fresh `targetReached` check; if the previous row's scroll
   * already brought this row into view, fn can no-op immediately.
   */
  async runExclusiveRecovery<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.recoveryMutex) this.recoveryMutex = new Mutex();
    return this.recoveryMutex.run(fn);
  }

  private broadcastError(colIndex: number, err: unknown) {
    const bucket = this.buckets.get(colIndex);
    if (bucket) {
      for (const { reject } of bucket) reject(err);
      this.buckets.delete(colIndex);
    }
  }
}
