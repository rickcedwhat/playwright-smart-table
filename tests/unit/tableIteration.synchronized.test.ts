import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TableIterationEnv } from '../../src/engine/tableIteration';
import { runMap } from '../../src/engine/tableIteration';
import type { FinalTableConfig } from '../../src/types';

vi.mock('../../src/utils/elementTracker', () => ({
  ElementTracker: class {
    private _called = false;
    async getUnseenIndices(locators: any) {
      if (this._called) return [];
      this._called = true;
      const rows = await locators.all();
      return rows.map((_: any, i: number) => i);
    }
    async cleanup() {}
  },
}));

/**
 * Two fake rows whose toJSON participates in the same NavigationBarrier as real SmartRow
 * (first column sync). Under mutex+barrier this deadlocks; synchronized must complete.
 */
function makeBarrierEnv(rowCount: number): TableIterationEnv<any> {
  const config: FinalTableConfig = {
    rowSelector: 'tr',
    headerSelector: 'th',
    cellSelector: 'td',
    maxPages: 1,
    autoScroll: false,
    headerTransformer: ({ text }: any) => text,
    onReset: async () => {},
    strategies: {},
    debug: { logLevel: 'none' },
  } as any;

  return {
    getRowLocators: () =>
      ({
        all: async () => Array.from({ length: rowCount }, (_, i) => ({ _index: i })),
      }) as any,
    getMap: () => new Map([['A', 0]]),
    advancePage: async () => false,
    makeSmartRow: (_loc: any, _map: any, idx: number, _page: number | undefined, barrier: any) =>
      ({
        rowIndex: idx,
        toJSON: async () => {
          if (barrier) {
            await barrier.sync(0, async () => {});
          }
          return { row: idx };
        },
      }) as any,
    createSmartRowArray: (arr: any[]) => arr as any,
    config,
    getPage: () => ({}) as any,
  };
}

describe('runMap synchronized + NavigationBarrier', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('completes with multiple rows (no mutex/barrier deadlock)', async () => {
    const env = makeBarrierEnv(3);
    const results = await runMap(
      env,
      async ({ row }) => (row as any).toJSON(),
      { concurrency: 'synchronized' }
    );
    expect(results).toHaveLength(3);
  });
});
