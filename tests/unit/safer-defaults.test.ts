import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { waitWhileTableLoading } from '../../src/utils/loadingWait';
import { SET_CURRENT_PAGE_INDEX, setCurrentPageIndex } from '../../src/utils/pageIndex';
import { muiDataGrid, muiTable } from '../../src/presets/mui';
import { useTable } from '../../src/useTable';
import { TableMapper } from '../../src/engine/tableMapper';

vi.mock('../../src/utils/elementTracker', () => {
  return {
    ElementTracker: class {
      private _called = false;
      async peekUnseenIndices(locators: any) {
        if (this._called) return [];
        const rows = await locators.all();
        return rows.map((_: any, i: number) => i);
      }
      async commitIndices() {
        this._called = true;
      }
      async getUnseenIndices(locators: any) {
        const indices = await this.peekUnseenIndices(locators);
        await this.commitIndices();
        return indices;
      }
      async cleanup() {}
    },
  };
});

import { runMap } from '../../src/engine/tableIteration';

describe('safer defaults', () => {
  describe('waitWhileTableLoading', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    const page = {
      waitForTimeout: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
    };

    it.each([
      { loading: { sortStabilizationTimeout: 5 }, options: undefined, expected: 10_000 },
      { loading: { loadingTimeout: 50, sortStabilizationTimeout: 5 }, options: undefined, expected: 50 },
      { loading: { loadingTimeout: 50 }, options: { timeout: 25 }, expected: 25 },
    ])('uses the correct timeout for $loading and $options', async ({ loading, options, expected }) => {
      const done = vi.fn();
      const config = { strategies: { loading: { ...loading, isTableLoading: async () => true } } };
      const waiting = waitWhileTableLoading(config as any, {} as any, page as any, 'test', options).then(done);
      await vi.advanceTimersByTimeAsync(expected - 1);
      expect(done).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await waiting;
      expect(done).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('bounds a pending predicate by the remaining budget after earlier polls', async () => {
      const predicate = vi.fn()
        .mockResolvedValueOnce(true)
        .mockImplementation(() => new Promise(() => {}));
      const config = { strategies: { loading: { isTableLoading: predicate, loadingTimeout: 50 } } };
      const done = vi.fn();
      const waiting = waitWhileTableLoading(config as any, {} as any, page as any, 'test', { pollInterval: 20 }).then(done);
      await vi.advanceTimersByTimeAsync(49);
      expect(predicate).toHaveBeenCalledTimes(2);
      expect(done).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await waiting;
      expect(done).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('caps a long poll by the budget left after a slow predicate', async () => {
      const waitForTimeout = vi.spyOn(page, 'waitForTimeout');
      const config = { strategies: { loading: {
        isTableLoading: () => new Promise(resolve => setTimeout(() => resolve(true), 30)),
        loadingTimeout: 50,
      } } };
      const waiting = waitWhileTableLoading(config as any, {} as any, page as any, 'test', { pollInterval: 1000 });
      await vi.advanceTimersByTimeAsync(50);
      await waiting;
      expect(waitForTimeout).toHaveBeenCalledExactlyOnceWith(20);
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each([false, new Error('predicate failed')])('clears the deadline timer when the predicate settles: %s', async result => {
      const config = { strategies: { loading: { isTableLoading: async () => {
        if (result instanceof Error) throw result;
        return result;
      } } } };
      const waiting = waitWhileTableLoading(config as any, {} as any, page as any, 'test');
      if (result instanceof Error) await expect(waiting).rejects.toBe(result);
      else await waiting;
      expect(vi.getTimerCount()).toBe(0);
    });

    it('returns immediately when isTableLoading is unset', async () => {
      const page = { waitForTimeout: vi.fn() };
      await waitWhileTableLoading(
        { strategies: {}, debug: { logLevel: 'none' } } as any,
        {} as any,
        page as any,
        'test'
      );
      expect(page.waitForTimeout).not.toHaveBeenCalled();
    });
  });

  describe('map concurrency default', () => {
    it('defaults to sequential (mode=sequential in verbose log)', async () => {
      const logs: string[] = [];
      const spy = vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
        logs.push(String(args[0]));
      });
      try {
        const rows = [{ rowIndex: 0 }, { rowIndex: 1 }];
        const config = {
          maxPages: 1,
          debug: { logLevel: 'verbose' as const },
          strategies: {},
        };
        await runMap(
          {
            getRowLocators: () => ({ all: async () => rows }) as any,
            getMap: () => new Map([['A', 0]]),
            advancePage: async () => false,
            makeSmartRow: (loc: any, _map: any, idx: number) => ({ ...loc, rowIndex: idx }),
            createSmartRowArray: (r: any[]) => r,
            config,
            getPage: () => ({ waitForTimeout: vi.fn() }) as any,
            getCurrentPageIndex: () => 0,
            getContext: () => ({}),
          } as any,
          async ({ row }) => (row as any).rowIndex
        );
        expect(logs.some((l) => l.includes('mode=sequential'))).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('warnings with default logging', () => {
    afterEach(() => vi.restoreAllMocks());

    it('warns on manual page assignment but keeps internal navigation silent', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const table = useTable({} as any);
      setCurrentPageIndex(table, 2);
      expect(warn).not.toHaveBeenCalled();
      table.currentPageIndex = 3;
      expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('Manually assigning table.currentPageIndex'));
      expect(table.currentPageIndex).toBe(3);
    });

    it.each(['goNext', 'goNextBulk'])('warns when %s is configured with default maxPages', async method => {
      vi.spyOn(TableMapper.prototype, 'getMap').mockResolvedValue(new Map([['Name', 0]]));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const table = useTable({} as any, { strategies: { pagination: { [method]: async () => false } } });
      await table.init();
      expect(warn).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('maxPages is 1'));
    });
  });

  describe('currentPageIndex setter path', () => {
    it('setCurrentPageIndex uses internal symbol without touching public setter', () => {
      let value = 0;
      let publicSets = 0;
      const table = {
        get currentPageIndex() {
          return value;
        },
        set currentPageIndex(n: number) {
          publicSets++;
          value = n;
        },
        [SET_CURRENT_PAGE_INDEX]: (n: number) => {
          value = n;
        },
      };
      setCurrentPageIndex(table, 3);
      expect(value).toBe(3);
      expect(publicSets).toBe(0);
    });
  });

  describe('MUI doSort trigger-only', () => {
    it('muiTable.doSort clicks once (no retry loop)', async () => {
      const click = vi.fn().mockResolvedValue(undefined);
      const sortLabel = {
        isVisible: vi.fn().mockResolvedValue(true),
        click,
      };
      const header = {
        locator: vi.fn().mockReturnValue({ first: () => sortLabel }),
      };
      const getSortState = vi.fn();
      const context = {
        getHeaderCell: vi.fn().mockResolvedValue(header),
        page: { waitForTimeout: vi.fn() },
        config: { strategies: { sorting: { getSortState } } },
      } as any;

      const doSort = (muiTable as any).strategies.sorting.doSort;
      await doSort({ columnName: 'Calories', direction: 'desc', context });

      expect(click).toHaveBeenCalledTimes(1);
      expect(getSortState).not.toHaveBeenCalled();
    });

    it('muiDataGrid.doSort clicks once with no fixed 500ms wait', async () => {
      const click = vi.fn().mockImplementation(async () => {});
      const waitForTimeout = vi.fn().mockResolvedValue(undefined);
      const clickTarget = {
        isVisible: vi.fn().mockResolvedValue(true),
        click,
      };
      const header = {
        locator: vi.fn().mockReturnValue({ first: () => clickTarget }),
        click: vi.fn(),
      };
      const stubLocator = {
        count: vi.fn().mockResolvedValue(0),
        isVisible: vi.fn().mockResolvedValue(false),
        innerText: vi.fn().mockResolvedValue('1–10 of 10'),
        waitFor: vi.fn().mockResolvedValue(undefined),
        first: vi.fn().mockReturnThis(),
      };
      const context = {
        page: { waitForTimeout },
        root: { locator: vi.fn().mockReturnValue(stubLocator) },
        getHeaderCell: vi.fn().mockResolvedValue(header),
        config: { strategies: { sorting: { getSortState: vi.fn() }, loading: {} } },
      } as any;

      const doSort = (muiDataGrid as any).strategies.sorting.doSort;
      await doSort({ columnName: 'Desk', direction: 'desc', context });

      expect(click).toHaveBeenCalledTimes(1);
      expect(waitForTimeout.mock.calls.filter(([ms]) => ms === 500)).toHaveLength(0);
    });
  });
});
