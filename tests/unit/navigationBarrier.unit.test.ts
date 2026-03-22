import { describe, it, expect, vi } from 'vitest';
import { NavigationBarrier } from '../../src/utils/navigationBarrier';
import { Mutex } from '../../src/utils/mutex';

describe('Navigation Orchestrator Utilities', () => {
  describe('NavigationBarrier', () => {
    it('should synchronize multiple callers and perform the action once', async () => {
      const barrier = new NavigationBarrier(3);
      const action = vi.fn().mockResolvedValue(undefined);
      
      const p1 = barrier.sync(10, action);
      const p2 = barrier.sync(10, action);
      
      expect(action).not.toHaveBeenCalled();
      
      const p3 = barrier.sync(10, action);
      
      await Promise.all([p1, p2, p3]);
      
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('should resolve immediately if total is 1', async () => {
      const barrier = new NavigationBarrier(1);
      const action = vi.fn().mockResolvedValue(undefined);
      
      await barrier.sync(5, action);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('should handle rows that finish early', async () => {
      const barrier = new NavigationBarrier(3);
      const action = vi.fn().mockResolvedValue(undefined);
      
      const p1 = barrier.sync(10, action);
      barrier.markFinished(); // Row 2 finished
      
      expect(action).not.toHaveBeenCalled();
      
      const p3 = barrier.sync(10, action); // Row 3 arrives, now 2/3 are "ready", and 1 is finished
      
      await Promise.all([p1, p3]);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('should broadcast even if all remaining rows finish', async () => {
      const barrier = new NavigationBarrier(2);
      const action = vi.fn().mockResolvedValue(undefined);
      
      const p1 = barrier.sync(10, action);
      barrier.markFinished(); // Row 2 finishes
      
      await p1;
      expect(action).not.toHaveBeenCalled(); // No move needed because everyone finished or moved
    });
  });

  describe('Mutex', () => {
    it('should ensure sequential execution', async () => {
      const mutex = new Mutex();
      const results: number[] = [];
      
      const run = async (id: number, ms: number) => {
        await mutex.run(async () => {
           await new Promise(r => setTimeout(r, ms));
           results.push(id);
        });
      };

      await Promise.all([
        run(1, 20),
        run(2, 5),
        run(3, 10)
      ]);

      expect(results).toEqual([1, 2, 3]);
    });

    it('should not break the chain on error', async () => {
      const mutex = new Mutex();
      const results: number[] = [];

      await Promise.allSettled([
        mutex.run(async () => { throw new Error('fail'); }),
        mutex.run(async () => { results.push(2); })
      ]);

      expect(results).toEqual([2]);
    });
  });
});
