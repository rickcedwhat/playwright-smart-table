/**
 * A synchronization barrier that allows multiple parallel row processors 
 * to coordinate their navigation actions.
 */
export class NavigationBarrier {
  private total: number;
  private finishedCount = 0;
  // Map of colIndex -> Set of waiting resolvers
  private buckets: Map<number, Set<(v: any) => void>> = new Map();

  constructor(total: number) {
    this.total = total;
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

    return new Promise((resolve) => {
      let bucket = this.buckets.get(colIndex);
      if (!bucket) {
        bucket = new Set();
        this.buckets.set(colIndex, bucket);
      }
      bucket.add(resolve);

      if (bucket.size + this.finishedCount >= this.total) {
        // Use a self-executing async function to handle the moveAction synchronously in this context
        (async () => {
          let result: T | undefined;
          try {
            if (moveAction) result = await moveAction();
          } finally {
            this.broadcast(colIndex, result);
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
    // Check all buckets - any bucket that was waiting for this row might now be ready
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
      for (const resolve of bucket) {
        resolve(result);
      }
      this.buckets.delete(colIndex);
    }
  }
}
