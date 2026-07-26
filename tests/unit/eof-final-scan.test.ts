import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TableIterationEnv } from '../../src/engine/tableIteration';
import { runMap, runForEach } from '../../src/engine/tableIteration';
import type { FinalTableConfig } from '../../src/types';

/**
 * Mock ElementTracker that tracks seen indices across pages via a simple Set.
 * Each call to peekUnseenIndices returns indices not yet committed.
 */
vi.mock('../../src/utils/elementTracker', () => ({
  ElementTracker: class {
    private _seen = new Set<number>();
    async peekUnseenIndices(locators: any) {
      const rows = await locators.all();
      return rows
        .map((_: any, i: number) => i)
        .filter((i: number) => {
          const id = rows[i]?._id ?? i;
          return !this._seen.has(id);
        });
    }
    async commitIndices(locators: any, indices: number[]) {
      const rows = await locators.all();
      for (const i of indices) {
        this._seen.add(rows[i]?._id ?? i);
      }
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
  return { _id: id, _index: id, count: async () => 1 };
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

describe('EOF final scan (#383)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('map collects rows revealed by the final scroll when advancePage returns false', async () => {
    // Page 1: rows 0,1.  After advance (returns true): rows 2,3.
    // After second advance (returns false — EOF): rows 4,5 appear (last scroll revealed them).
    let page = 0;
    const pages = [
      [makeRow(0), makeRow(1)],
      [makeRow(2), makeRow(3)],
      [makeRow(4), makeRow(5)],
    ];

    const env: TableIterationEnv<any> = {
      getRowLocators: () => ({ all: async () => pages[page] }) as any,
      getMap: () => new Map([['A', 0]]),
      advancePage: async () => {
        if (page < 2) {
          page++;
          return true;
        }
        // Simulate: scroll happened, new rows appeared, but stabilization said "no change"
        page = 2;
        return false;
      },
      makeSmartRow: (_loc: any, _map: any, idx: number) =>
        ({ rowIndex: idx, toJSON: async () => ({ id: idx }) }) as any,
      createSmartRowArray: (arr: any[]) => arr as any,
      config: baseConfig,
      getPage: () => ({}) as any,
      getCurrentPageIndex: () => page,
      getContext: () => ({ root: {} as any, config: baseConfig, resolve: (() => {}) as any, page: {} as any }),
    } as any;

    const results = await runMap(env, async ({ row }) => ({ id: (row as any).rowIndex }), {});
    expect(results).toHaveLength(6);
    expect(results.map((r: any) => r.id)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('forEach visits rows revealed by the final scroll', async () => {
    let page = 0;
    const pages = [
      [makeRow(0), makeRow(1)],
      [makeRow(2), makeRow(3)],
    ];

    const env: TableIterationEnv<any> = {
      getRowLocators: () => ({ all: async () => pages[page] }) as any,
      getMap: () => new Map([['A', 0]]),
      advancePage: async () => {
        if (page < 1) {
          page++;
          return true;
        }
        // EOF: stabilization returned false, but rows 2,3 are newly visible
        return false;
      },
      makeSmartRow: (_loc: any, _map: any, idx: number) =>
        ({ rowIndex: idx }) as any,
      createSmartRowArray: (arr: any[]) => arr as any,
      config: baseConfig,
      getPage: () => ({}) as any,
      getCurrentPageIndex: () => page,
      getContext: () => ({ root: {} as any, config: baseConfig, resolve: (() => {}) as any, page: {} as any }),
    } as any;

    const visited: number[] = [];
    await runForEach(env, ({ row }) => { visited.push(row.rowIndex!); }, {});
    expect(visited).toEqual([0, 1, 2, 3]);
  });

  it('no extra scan when advancePage returns false and no new rows exist', async () => {
    // Verifies we don't loop infinitely: same rows on both pages, advancePage returns false.
    const rows = [makeRow(0), makeRow(1)];

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

    const results = await runMap(env, async ({ row }) => ({ id: (row as any).rowIndex }), {});
    expect(results).toHaveLength(2);
  });

  it('final scan respects stop() — does not process rows beyond stoppedIndex', async () => {
    let page = 0;
    const pages = [
      [makeRow(0), makeRow(1)],
      [makeRow(2), makeRow(3)],
    ];

    const env: TableIterationEnv<any> = {
      getRowLocators: () => ({ all: async () => pages[page] }) as any,
      getMap: () => new Map([['A', 0]]),
      advancePage: async () => {
        if (page < 1) {
          page++;
          return false; // EOF immediately after first page
        }
        return false;
      },
      makeSmartRow: (_loc: any, _map: any, idx: number) =>
        ({ rowIndex: idx }) as any,
      createSmartRowArray: (arr: any[]) => arr as any,
      config: baseConfig,
      getPage: () => ({}) as any,
      getCurrentPageIndex: () => page,
      getContext: () => ({ root: {} as any, config: baseConfig, resolve: (() => {}) as any, page: {} as any }),
    } as any;

    const visited: number[] = [];
    await runForEach(env, ({ row, stop }) => {
      visited.push(row.rowIndex!);
      if (row.rowIndex === 0) stop();
    }, {});
    // stop() at row 0 means row 1+ should not be visited
    expect(visited).toEqual([0]);
  });
});
