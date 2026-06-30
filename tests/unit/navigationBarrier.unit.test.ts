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

    it('fast-path rows (no moveAction) do not allow markFinished to fire prematurely for waiting peers', async () => {
      // Scenario: 5-row batch. Rows 0 and 1 take the fast path — they call barrier.sync(7)
      // with NO moveAction (cell already in DOM). Rows 2-4 need the scroll and call
      // barrier.sync(7, action). If markFinished() from fast-path rows fires before all
      // waiting rows arrive, action would fire too early (before all peers are ready).
      const barrier = new NavigationBarrier(5);
      const action = vi.fn().mockResolvedValue(undefined);

      // Fast-path rows join the barrier WITHOUT a moveAction
      const fp0 = barrier.sync(7); // no moveAction
      const fp1 = barrier.sync(7); // no moveAction

      // Rows needing scroll join WITH moveAction
      const p2 = barrier.sync(7, action);
      const p3 = barrier.sync(7, action);

      // Only 4/5 have joined — action must NOT fire yet
      expect(action).not.toHaveBeenCalled();

      // Last row arrives — barrier fires exactly once
      const p4 = barrier.sync(7, action);
      await Promise.all([fp0, fp1, p2, p3, p4]);

      expect(action).toHaveBeenCalledTimes(1);
    });

    it('resolves immediately and calls moveAction when total is 0', async () => {
      const barrier = new NavigationBarrier(0);
      const action = vi.fn().mockResolvedValue('result');

      const result = await barrier.sync(0, action);

      expect(action).toHaveBeenCalledOnce();
      expect(result).toBe('result');
    });

    it('resolves immediately without calling moveAction when total is 0 and no action given', async () => {
      const barrier = new NavigationBarrier(0);
      // should not throw or hang
      const result = await barrier.sync(0);
      expect(result).toBeUndefined();
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
