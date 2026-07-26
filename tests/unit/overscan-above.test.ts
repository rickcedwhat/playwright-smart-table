import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TableIterationEnv } from '../../src/engine/tableIteration';
import { runMap } from '../../src/engine/tableIteration';
import type { FinalTableConfig } from '../../src/types';

vi.mock('../../src/utils/elementTracker', () => ({
  ElementTracker: class {
    private _seen = new Set<number>();
    async peekUnseenIndices(locators: any) {
      const rows = await locators.all();
      return rows
        .map((_: any, i: number) => i)
        .filter((i: number) => !this._seen.has(rows[i]?._id ?? i));
    }
    async commitIndices(locators: any, indices: number[]) {
      const rows = await locators.all();
      for (const i of indices) this._seen.add(rows[i]?._id ?? i);
    }
    async getUnseenIndices(locators: any) {
      const indices = await this.peekUnseenIndices(locators);
      await this.commitIndices(locators, indices);
      return indices;
    }
    async cleanup() {}
  },
}));

function makeRow(id: number) {
  return { _id: id, count: async () => 1 };
}

const baseConfig: FinalTableConfig = {
  rowSelector: 'tr',
  headerSelector: 'th',
  cellSelector: 'td',
  maxPages: 10,
  autoScroll: false,
  headerTransformer: ({ text }: any) => text,
  onReset: async () => {},
  strategies: {},
  debug: { logLevel: 'none' },
} as any;

describe('overscan above visible range (#384)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('collects overscan rows above the visible range that would be skipped by a large scroll', async () => {
    // Simulates a virtualized table with overscan. The viewport shows 3 rows but
    // the scroller mounts 5 (1 overscan above, 3 visible, 1 overscan below).
    //
    // Page 0: DOM indices [0,1,2,3,4], visible = [1,2,3]
    //   - Row 0 is overscan above, row 4 is overscan below
    //   - Without fix: only rows 1,2,3 committed; rows 0,4 left unseen
    //   - With fix: rows 0,1,2,3 committed (0 is above visible); row 4 deferred
    //
    // Page 1 (after large scroll): DOM indices [5,6,7,8,9], visible = [6,7,8]
    //   - Row 4 never reappears — permanently lost without fix
    //   - Row 5 is overscan above this page — collected with fix
    //
    // But row 4 was overscan BELOW on page 0, so it was deferred. On page 1,
    // it's gone from the DOM entirely. The final-scan (#383) won't help because
    // it's not in the DOM anymore. This is the documented gap: overscan below
    // that never scrolls into view. The fix for #384 handles the above case.

    let page = 0;

    // Page 0: rows 0-4 in DOM, visible = [1,2,3]
    // Page 1: rows 3-7 in DOM, visible = [4,5,6]
    //   Row 3 was visible on page 0 (already committed)
    //   Row 4 was overscan below on page 0, now overscan above on page 1 → collected
    const pages = [
      [makeRow(0), makeRow(1), makeRow(2), makeRow(3), makeRow(4)],
      [makeRow(3), makeRow(4), makeRow(5), makeRow(6), makeRow(7)],
    ];
    const visiblePerPage = [
      new Set([1, 2, 3]),  // DOM indices 1,2,3 are visible on page 0
      new Set([2, 3, 4]),  // DOM indices 2,3,4 are visible on page 1
    ];

    const config: FinalTableConfig = {
      ...baseConfig,
      strategies: {
        viewport: {
          getVisibleRowIndices: async () => visiblePerPage[page],
        },
      },
    } as any;

    const env: TableIterationEnv<any> = {
      getRowLocators: () => ({ all: async () => pages[page] }) as any,
      getMap: () => new Map([['A', 0]]),
      advancePage: async () => {
        if (page === 0) { page = 1; return true; }
        return false;
      },
      makeSmartRow: (_loc: any, _map: any, idx: number) =>
        ({ rowIndex: idx }) as any,
      createSmartRowArray: (arr: any[]) => arr as any,
      config,
      getPage: () => ({}) as any,
      getCurrentPageIndex: () => page,
      getContext: () => ({ root: {} as any, config, resolve: (() => {}) as any, page: {} as any }),
    } as any;

    const results = await runMap(env, async ({ row }) => row.rowIndex, {});

    // All 8 unique rows should be collected:
    // Page 0: row 0 (overscan above → collected), rows 1,2,3 (visible)
    // Page 1: row 4 (overscan above → collected), rows 5,6,7 (visible)
    // Row 3 appears on both pages but is only counted once (already committed)
    expect(results).toHaveLength(8);
  });

  it('still filters out overscan rows below the visible range', async () => {
    // Only one page. Overscan below should be deferred (not collected).
    const rows = [makeRow(0), makeRow(1), makeRow(2), makeRow(3), makeRow(4)];
    const visible = new Set([1, 2, 3]); // rows 0 above, 4 below

    const config: FinalTableConfig = {
      ...baseConfig,
      strategies: {
        viewport: {
          getVisibleRowIndices: async () => visible,
        },
      },
    } as any;

    const env: TableIterationEnv<any> = {
      getRowLocators: () => ({ all: async () => rows }) as any,
      getMap: () => new Map([['A', 0]]),
      advancePage: async () => false,
      makeSmartRow: (_loc: any, _map: any, idx: number) =>
        ({ rowIndex: idx }) as any,
      createSmartRowArray: (arr: any[]) => arr as any,
      config,
      getPage: () => ({}) as any,
      getCurrentPageIndex: () => 0,
      getContext: () => ({ root: {} as any, config, resolve: (() => {}) as any, page: {} as any }),
    } as any;

    const results = await runMap(env, async ({ row }) => row.rowIndex, {});

    // Row 0 (above) collected, rows 1,2,3 (visible) collected.
    // Row 4 (below) deferred, then picked up by final scan (#383).
    // Final scan: page hasn't changed, row 4 is still below visible → still deferred.
    // So only 4 rows collected (0,1,2,3). Row 4 remains uncollected.
    // BUT: #383 final scan runs, and row 4 is unseen. The final scan calls
    // getVisibleRowIndices again — row 4 is still below → filtered out.
    // Result: 4 rows.
    expect(results).toHaveLength(4);
  });

  it('no filtering without getVisibleRowIndices — all rows collected', async () => {
    const rows = [makeRow(0), makeRow(1), makeRow(2)];

    const env: TableIterationEnv<any> = {
      getRowLocators: () => ({ all: async () => rows }) as any,
      getMap: () => new Map([['A', 0]]),
      advancePage: async () => false,
      makeSmartRow: (_loc: any, _map: any, idx: number) =>
        ({ rowIndex: idx }) as any,
      createSmartRowArray: (arr: any[]) => arr as any,
      config: baseConfig,
      getPage: () => ({}) as any,
      getCurrentPageIndex: () => 0,
      getContext: () => ({ root: {} as any, config: baseConfig, resolve: (() => {}) as any, page: {} as any }),
    } as any;

    const results = await runMap(env, async ({ row }) => row.rowIndex, {});
    expect(results).toHaveLength(3);
  });
});
