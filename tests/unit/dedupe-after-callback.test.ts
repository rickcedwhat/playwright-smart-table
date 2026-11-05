import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TableIterationEnv } from '../../src/engine/tableIteration';
import { runMap } from '../../src/engine/tableIteration';
import type { FinalTableConfig, RowIterationContext } from '../../src/types';

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

function makeRow(id: number, dedupeKey: string) {
  return { _id: id, _dedupeKey: dedupeKey, count: async () => 1 };
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

function makeEnv(pages: ReturnType<typeof makeRow>[][]): TableIterationEnv<any> {
  let page = 0;
  return {
    getRowLocators: () => ({ all: async () => pages[page] }) as any,
    getMap: () => new Map([['A', 0]]),
    advancePage: async () => {
      if (page < pages.length - 1) { page++; return true; }
      return false;
    },
    makeSmartRow: (loc: any, _map: any, idx: number) =>
      ({ rowIndex: idx, _dedupeKey: loc._dedupeKey }) as any,
    createSmartRowArray: (arr: any[]) => arr as any,
    config: baseConfig,
    getPage: () => ({}) as any,
    getCurrentPageIndex: () => page,
    getContext: () => ({ root: {} as any, config: baseConfig, resolve: (() => {}) as any, page: {} as any }),
  } as any;
}

describe('dedupe key registration after callback (#382)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers key after successful callback — real duplicates still deduplicated', async () => {
    const env = makeEnv([
      [makeRow(0, 'alice')],
      [makeRow(1, 'alice')],
    ]);

    const results = await runMap(env, async ({ row }) => {
      return { key: (row as any)._dedupeKey };
    }, {
      dedupe: async (row: any) => row._dedupeKey,
      concurrency: 'sequential',
    });

    expect(results).toHaveLength(1);
    expect((results[0] as any).key).toBe('alice');
  });

  it('null is successful and commits the key captured before the callback', async () => {
    const env = makeEnv([
      [makeRow(0, 'alice')],
      [makeRow(1, 'bob'), makeRow(2, 'alice')],
    ]);

    let first = true;
    const callback = vi.fn(async ({ row }: RowIterationContext) => {
      if (first) {
        first = false;
        // Identity changes after the dedupe check; null is still a valid mapped value.
        (row as any)._dedupeKey = 'bob';
        return null;
      }
      return { key: (row as any)._dedupeKey };
    });
    const results = await runMap(env, callback, {
      dedupe: async (row: any) => row._dedupeKey,
      concurrency: 'sequential',
    });

    // Commit the original Alice key, not Bob: keep the later Bob and skip Alice.
    expect(results).toEqual([null, { key: 'bob' }]);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('same-batch parallel rows with identical keys both collected (no pre-registration race)', async () => {
    // Two rows on the same page with the same dedupe key. In parallel mode,
    // both check the set before either registers. With post-callback registration,
    // both pass the check and both get collected. This is a known trade-off:
    // temporary duplicates are preferable to permanent holes.
    const env = makeEnv([
      [makeRow(0, 'dave'), makeRow(1, 'dave')],
    ]);

    const results = await runMap(env, async ({ row }) => {
      return { key: (row as any)._dedupeKey, idx: row.rowIndex };
    }, {
      dedupe: async (row: any) => row._dedupeKey,
      concurrency: 'parallel',
    });

    // Both collected in parallel — post-scrape unique is the caller's job
    expect(results).toHaveLength(2);
  });

  it('sequential mode still deduplicates within the same page', async () => {
    // In sequential mode, row 0 registers before row 1 checks → row 1 is skipped.
    const env = makeEnv([
      [makeRow(0, 'eve'), makeRow(1, 'eve')],
    ]);

    const results = await runMap(env, async ({ row }) => {
      return { key: (row as any)._dedupeKey, idx: row.rowIndex };
    }, {
      dedupe: async (row: any) => row._dedupeKey,
      concurrency: 'sequential',
    });

    expect(results).toHaveLength(1);
    expect((results[0] as any).idx).toBe(0);
  });
});
