import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  planNavigationPath,
  executeNavigationWithGoToPageRetry,
  executeNavigationPath,
} from '../../src/utils/paginationPath';
import type { PaginationPrimitives, TableContext } from '../../src/types';

describe('planNavigationPath', () => {
  const noPrimitives: PaginationPrimitives = {};
  const nextOnly: PaginationPrimitives = { goNext: async () => true };
  const prevOnly: PaginationPrimitives = { goPrevious: async () => true };
  const nextAndPrev: PaginationPrimitives = {
    goNext: async () => true,
    goPrevious: async () => true,
  };
  const bulk10NoPrev: PaginationPrimitives = {
    goNext: async () => true,
    goNextBulk: async () => 10,
    nextBulkPages: 10,
  };
  const bulk10WithPrev: PaginationPrimitives = {
    goNext: async () => true,
    goPrevious: async () => true,
    goNextBulk: async () => 10,
    goPreviousBulk: async () => 10,
    nextBulkPages: 10,
    previousBulkPages: 10,
  };
  const withGoToPage: PaginationPrimitives = {
    goToPage: async () => true,
    goNext: async () => true,
    goPrevious: async () => true,
  };

  describe('same page', () => {
    it('returns empty path when current equals target', () => {
      expect(planNavigationPath(5, 5, nextAndPrev)).toEqual([]);
    });
  });

  describe('when goToPage is present', () => {
    it('returns single goToPage step', () => {
      expect(planNavigationPath(0, 38, withGoToPage)).toEqual([
        { type: 'goToPage', pageIndex: 38 },
      ]);
      expect(planNavigationPath(10, 2, withGoToPage)).toEqual([
        { type: 'goToPage', pageIndex: 2 },
      ]);
    });
  });

  describe('forward (target > current)', () => {
    it('uses only goNext when no bulk', () => {
      expect(planNavigationPath(0, 5, nextOnly)).toEqual([
        { type: 'goNext', count: 5 },
      ]);
    });

    it('uses goNext only when bulk would overshoot and no goPrevious (3→12, bulk 10)', () => {
      const path = planNavigationPath(3, 12, bulk10NoPrev);
      expect(path).toEqual([{ type: 'goNext', count: 9 }]);
      expect(path.some((s) => s.type === 'goNextBulk')).toBe(false);
    });

    it('uses goNextBulk + goPrevious when overshoot is cheaper and goPrevious exists (3→12, bulk 10)', () => {
      const path = planNavigationPath(3, 12, bulk10WithPrev);
      expect(path).toEqual([
        { type: 'goNextBulk', count: 1 },
        { type: 'goPrevious', count: 1 },
      ]);
    });

    it('uses goNextBulk then goNext for exact remainder (3→35, bulk 10)', () => {
      expect(planNavigationPath(3, 35, bulk10WithPrev)).toEqual([
        { type: 'goNextBulk', count: 3 },
        { type: 'goNext', count: 2 },
      ]);
    });

    it('uses only goNext when steps less than bulk size (0→5, bulk 10)', () => {
      expect(planNavigationPath(0, 5, bulk10WithPrev)).toEqual([
        { type: 'goNext', count: 5 },
      ]);
    });
  });

  describe('forward with goToLast optimization', () => {
    const withGoToLast: PaginationPrimitives = {
      goNext: async () => true,
      goPrevious: async () => true,
      goToLast: async () => true,
    };

    it('uses wrap-around path when it is shorter (e.g. 0 -> 99 with 100 total pages)', () => {
      const path = planNavigationPath(0, 99, withGoToLast, 100);
      expect(path).toEqual([{ type: 'goToLast', targetIndex: 99 }]);
    });

    it('uses wrap-around path when backward steps are cheaper (e.g. 0 -> 98 with 100 total pages)', () => {
      const path = planNavigationPath(0, 98, withGoToLast, 100);
      expect(path).toEqual([
        { type: 'goToLast', targetIndex: 99 },
        { type: 'goPrevious', count: 1 }
      ]);
    });

    it('uses normal forward path when it is cheaper (e.g. 0 -> 1 with 100 total pages)', () => {
      const path = planNavigationPath(0, 1, withGoToLast, 100);
      expect(path).toEqual([
        { type: 'goNext', count: 1 }
      ]);
    });
  });

  describe('backward (target < current)', () => {
    it('uses only goPrevious when no bulk', () => {
      expect(planNavigationPath(5, 0, prevOnly)).toEqual([
        { type: 'goPrevious', count: 5 },
      ]);
    });

    it('uses goPrevious only when bulk would overshoot and no goNext (12→3, bulk 10)', () => {
      const path = planNavigationPath(12, 3, {
        goPrevious: async () => true,
        goPreviousBulk: async () => 10,
        previousBulkPages: 10,
      });
      expect(path).toEqual([{ type: 'goPrevious', count: 9 }]);
      expect(path.some((s) => s.type === 'goPreviousBulk')).toBe(false);
    });

    it('uses goPreviousBulk once when exact (13→3, bulk 10)', () => {
      const path = planNavigationPath(13, 3, bulk10WithPrev);
      expect(path).toEqual([{ type: 'goPreviousBulk', count: 1 }]);
    });

    it('uses goPreviousBulk then goPrevious when remainder is small (15→3, bulk 10)', () => {
      const path = planNavigationPath(15, 3, bulk10WithPrev);
      expect(path).toEqual([
        { type: 'goPreviousBulk', count: 1 },
        { type: 'goPrevious', count: 2 },
      ]);
    });

    it('uses goPreviousBulk + goNext when overshoot is cheaper (19→3, bulk 10)', () => {
      const path = planNavigationPath(19, 3, bulk10WithPrev);
      expect(path).toEqual([
        { type: 'goPreviousBulk', count: 2 },
        { type: 'goNext', count: 4 },
      ]);
    });

    it('uses goPreviousBulk then goPrevious for exact remainder (35→3, bulk 10)', () => {
      expect(planNavigationPath(35, 3, bulk10WithPrev)).toEqual([
        { type: 'goPreviousBulk', count: 3 },
        { type: 'goPrevious', count: 2 },
      ]);
    });
  });

  describe('no primitives or missing direction', () => {
    it('returns empty when no primitives', () => {
      expect(planNavigationPath(0, 5, noPrimitives)).toEqual([]);
    });

    it('returns empty when going backward with no goPrevious or goPreviousBulk', () => {
      expect(planNavigationPath(5, 0, nextOnly)).toEqual([]);
    });

    it('returns empty when going forward with no goNext or goNextBulk', () => {
      expect(planNavigationPath(0, 5, prevOnly)).toEqual([]);
    });
  });
});

describe('executeNavigationWithGoToPageRetry', () => {
  const mockContext = {} as TableContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses goNext only (not goNextBulk) when bulk would overshoot and goPrevious is missing (3→12)', async () => {
    const goToPage = vi.fn().mockResolvedValue(false);
    const goNext = vi.fn().mockResolvedValue(true);
    const goNextBulk = vi.fn().mockResolvedValue(10);
    let current = 3;
    const getCurrentPage = () => current;
    const setCurrentPage = (n: number) => {
      current = n;
    };

    const primitives: PaginationPrimitives = {
      goToPage,
      goNext,
      goNextBulk,
      nextBulkPages: 10,
      // no goPrevious
    };

    await executeNavigationWithGoToPageRetry(
      12,
      primitives,
      mockContext,
      getCurrentPage,
      setCurrentPage
    );

    expect(current).toBe(12);
    expect(goNextBulk).not.toHaveBeenCalled();
    expect(goNext).toHaveBeenCalledTimes(9);
  });

  it('uses goNextBulk when it would not overshoot (3→38)', async () => {
    const goToPage = vi.fn().mockResolvedValue(false);
    const goNext = vi.fn().mockResolvedValue(true);
    const goNextBulk = vi.fn().mockResolvedValue(10);
    let current = 3;
    const getCurrentPage = () => current;
    const setCurrentPage = (n: number) => {
      current = n;
    };

    const primitives: PaginationPrimitives = {
      goToPage,
      goNext,
      goNextBulk,
      nextBulkPages: 10,
    };

    await executeNavigationWithGoToPageRetry(
      38,
      primitives,
      mockContext,
      getCurrentPage,
      setCurrentPage
    );

    expect(current).toBe(38);
    expect(goNextBulk).toHaveBeenCalledTimes(3);
    expect(goNext).toHaveBeenCalledTimes(5);
  });

  it('stops when current equals target after stepping (goToPage false then one goNext)', async () => {
    const goToPage = vi.fn().mockResolvedValue(false);
    const goNext = vi.fn().mockResolvedValue(true);
    let current = 0;
    const getCurrentPage = () => current;
    const setCurrentPage = (n: number) => {
      current = n;
    };

    const primitives: PaginationPrimitives = {
      goToPage,
      goNext,
      nextBulkPages: 10,
    };

    await executeNavigationWithGoToPageRetry(
      1,
      primitives,
      mockContext,
      getCurrentPage,
      setCurrentPage
    );

    expect(goToPage).toHaveBeenCalledTimes(1);
    expect(goNext).toHaveBeenCalledTimes(1);
    expect(current).toBe(1);
  });
});


describe('planNavigationPath - comprehensive', () => {
  it('returns empty for same page', () => {
    expect(planNavigationPath(2, 2, {} as any)).toEqual([]);
  });

  it('prefers goToPage when available', () => {
    const p: PaginationPrimitives = { goToPage: async () => true };
    expect(planNavigationPath(0, 10, p)).toEqual([{ type: 'goToPage', pageIndex: 10 }]);
  });

  it('forward: uses goNext when no bulk', () => {
    const p: PaginationPrimitives = { goNext: async () => true };
    expect(planNavigationPath(0, 5, p)).toEqual([{ type: 'goNext', count: 5 }]);
  });

  it('forward: uses bulk+previous when overshoot cheaper', () => {
    const p: PaginationPrimitives = {
      goNextBulk: async () => 10,
      nextBulkPages: 10,
      goPrevious: async () => true,
      goPreviousBulk: async () => 10,
      previousBulkPages: 10,
    };
    const path = planNavigationPath(3, 12, p);
    expect(path.length).toBeGreaterThan(0);
    expect(path[0].type).toBe('goNextBulk');
  });

  it('backward: uses goPrevious when no bulk', () => {
    const p: PaginationPrimitives = { goPrevious: async () => true };
    expect(planNavigationPath(5, 0, p)).toEqual([{ type: 'goPrevious', count: 5 }]);
  });
});

describe('executeNavigationWithGoToPageRetry - behaviors & edge cases', () => {
  const mockContext = {} as TableContext;

  it('returns immediately when no goToPage', async () => {
    const primitives: PaginationPrimitives = {};
    let current = 0;
    await executeNavigationWithGoToPageRetry(5, primitives, mockContext, () => current, (n) => { current = n; });
    expect(current).toBe(0);
  });

  it('throws when goToPage false and no stepping primitives (forward)', async () => {
    const primitives: PaginationPrimitives = {
      goToPage: async () => false,
    };
    let current = 0;
    await expect(
      executeNavigationWithGoToPageRetry(1, primitives, mockContext, () => current, (n) => { current = n; })
    ).rejects.toThrow(/no goNext\/goNextBulk/);
  });

  it('throws when goToPage false and no stepping primitives (backward)', async () => {
    const primitives: PaginationPrimitives = {
      goToPage: async () => false,
    };
    let current = 5;
    await expect(
      executeNavigationWithGoToPageRetry(3, primitives, mockContext, () => current, (n) => { current = n; })
    ).rejects.toThrow(/no goPrevious\/goPreviousBulk/);
  });

  it('uses goPreviousBulk numeric return to step back', async () => {
    let current = 10;
    const primitives: PaginationPrimitives = {
      goToPage: async () => false,
      goPreviousBulk: async () => 3,
      previousBulkPages: 3,
      goPrevious: async () => true,
    };
    await executeNavigationWithGoToPageRetry(1, primitives, mockContext, () => current, (n) => { current = n; });
    expect(current).toBeLessThan(10);
  });

  it('advances using goNextBulk numeric return', async () => {
    let current = 3;
    const primitives: PaginationPrimitives = {
      goToPage: async () => false,
      goNextBulk: async () => 5,
      nextBulkPages: 5,
      goNext: async () => true,
    };
    await executeNavigationWithGoToPageRetry(
      20,
      primitives,
      mockContext,
      () => current,
      (n) => { current = n; }
    );
    expect(current).toBeGreaterThan(3);
  });
});

describe('executeNavigationPath - failure modes & updates', () => {
  it('runs goNext/goPrevious and updates current page', async () => {
    const calls: string[] = [];
    const primitives: any = {
      goNext: async () => { calls.push('next'); return true; },
      goPrevious: async () => { calls.push('prev'); return true; },
      goNextBulk: async () => 1,
      goPreviousBulk: async () => 1,
      goToPage: async () => true
    };

    let current = 2;
    const path = [
      { type: 'goNext', count: 2 } as any,
      { type: 'goPrevious', count: 1 } as any
    ];

    await executeNavigationPath(path, primitives, {} as any, () => current, (n) => { current = n; });
    expect(current).toBe(3);
  });

  it('throws when goToPage primitive fails', async () => {
    const primitives: any = {
      goToPage: async () => false,
    };
    let current = 0;
    const path = [{ type: 'goToPage', pageIndex: 5 } as any];
    await expect(executeNavigationPath(path, primitives, {} as any, () => current, (n) => { current = n; })).rejects.toThrow(/goToPage\(5\) failed/);
  });

  it('throws when goNextBulk fails', async () => {
    const primitives: any = {
      goNextBulk: async () => false,
    };
    let current = 0;
    const path = [{ type: 'goNextBulk', count: 1 } as any];
    await expect(executeNavigationPath(path, primitives, {} as any, () => current, (n) => { current = n; })).rejects.toThrow(/goNextBulk failed/);
  });

  it('throws when goPreviousBulk fails', async () => {
    const primitives: any = {
      goPreviousBulk: async () => false,
    };
    let current = 5;
    const path = [{ type: 'goPreviousBulk', count: 1 } as any];
    await expect(executeNavigationPath(path, primitives, {} as any, () => current, (n) => { current = n; })).rejects.toThrow(/goPreviousBulk failed/);
  });
});

