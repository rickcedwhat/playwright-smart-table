import { describe, it, expect, vi } from 'vitest';
import { waitWhileTableLoading } from '../../src/utils/loadingWait';
import { SET_CURRENT_PAGE_INDEX, setCurrentPageIndex } from '../../src/utils/pageIndex';
import { muiDataGrid, muiTable } from '../../src/presets/mui';

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

describe('gbu #434 safer defaults', () => {
  describe('waitWhileTableLoading', () => {
    it('stops polling after loadingTimeout even if still loading', async () => {
      const waits: number[] = [];
      const page = {
        waitForTimeout: vi.fn(async (ms: number) => {
          waits.push(ms);
        }),
      };
      let calls = 0;
      const config = {
        strategies: {
          loading: {
            isTableLoading: async () => {
              calls++;
              return true;
            },
            loadingTimeout: 50,
            sortStabilizationPollInterval: 20,
          },
        },
        debug: { logLevel: 'none' as const },
      } as any;

      const started = Date.now();
      await waitWhileTableLoading(config, {} as any, page as any, 'test');
      expect(Date.now() - started).toBeLessThan(2000);
      expect(calls).toBeGreaterThan(1);
      expect(waits.length).toBeGreaterThan(0);
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

    it('muiDataGrid.doSort clicks once', async () => {
      const click = vi.fn().mockImplementation(async () => {});
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
        page: { waitForTimeout: vi.fn().mockResolvedValue(undefined) },
        root: { locator: vi.fn().mockReturnValue(stubLocator) },
        getHeaderCell: vi.fn().mockResolvedValue(header),
        config: { strategies: { sorting: { getSortState: vi.fn() }, loading: {} } },
      } as any;

      const doSort = (muiDataGrid as any).strategies.sorting.doSort;
      await doSort({ columnName: 'Desk', direction: 'desc', context });

      expect(click).toHaveBeenCalledTimes(1);
    });
  });
});
