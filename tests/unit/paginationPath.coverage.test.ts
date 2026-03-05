import { describe, it, expect } from 'vitest';
import {
  planNavigationPath,
  executeNavigationWithGoToPageRetry,
  executeNavigationPath,
} from '../../src/utils/paginationPath';
import type { PaginationPrimitives, TableContext } from '../../src/types';

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

describe('executeNavigationWithGoToPageRetry', () => {
  const mockContext = {} as TableContext;

  it('returns immediately when no goToPage', async () => {
    const primitives: PaginationPrimitives = {};
    let current = 0;
    await executeNavigationWithGoToPageRetry(5, primitives, mockContext, () => current, (n) => { current = n; });
    expect(current).toBe(0);
  });

  it('throws when goToPage false and no stepping primitives', async () => {
    const primitives: PaginationPrimitives = {
      goToPage: async () => false,
    };
    let current = 0;
    await expect(
      executeNavigationWithGoToPageRetry(1, primitives, mockContext, () => current, (n) => { current = n; })
    ).rejects.toThrow();
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

describe('executeNavigationPath', () => {
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

  it('throws when a primitive fails', async () => {
    const primitives: any = {
      goNext: async () => false,
    };
    let current = 0;
    const path = [{ type: 'goNext', count: 1 } as any];
    await expect(executeNavigationPath(path, primitives, {} as any, () => current, (n) => { current = n; })).rejects.toThrow();
  });
});

