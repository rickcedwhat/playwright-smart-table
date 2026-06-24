/**
 * Verifies that debugDelay is called with the 'pagination' action type after
 * each successful page advance in RowFinder.findRows and findRowLocator (via
 * findRow). Kept in its own file so we can mock debugUtils without affecting
 * tests that exercise the real debugDelay implementation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Locator, Page } from '@playwright/test';

vi.mock('../../src/utils/elementTracker', () => ({
  ElementTracker: class {
    private _called = false;
    async getUnseenIndices(locators: any) {
      if (this._called) return [];
      const rows = await locators.all();
      this._called = true;
      return rows.map((_: any, i: number) => i);
    }
    async cleanup() {}
  },
}));

vi.mock('../../src/utils/debugUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/debugUtils')>();
  return { ...actual, debugDelay: vi.fn().mockResolvedValue(undefined) };
});

import { RowFinder } from '../../src/engine/rowFinder';
import type { FilterEngine } from '../../src/filterEngine';
import type { TableMapper } from '../../src/engine/tableMapper';
import type { FinalTableConfig, SmartRow, TableStrategies } from '../../src/types';
import * as debugUtils from '../../src/utils/debugUtils';

const debugDelaySpy = debugUtils.debugDelay as ReturnType<typeof vi.fn>;

function makeConfig(overrides: Partial<FinalTableConfig> = {}): FinalTableConfig {
  return {
    rowSelector: 'tr',
    headerSelector: 'th',
    cellSelector: 'td',
    maxPages: 3,
    autoScroll: false,
    headerTransformer: ({ text }) => text,
    onReset: async () => {},
    strategies: {} as TableStrategies,
    ...overrides,
  };
}

function makeRowFinder(config: FinalTableConfig) {
  const fakeLocator = {
    all: async (): Promise<Locator[]> => [],
    count: async (): Promise<number> => 0,
    filter: (): Locator => fakeLocator as unknown as Locator,
    first: (): Locator => null as unknown as Locator,
    page: (): Page => ({ waitForTimeout: async () => {} } as unknown as Page),
  };

  const rootLocator = fakeLocator as unknown as Locator;

  const filterEngine = {
    applyFilters: (): Locator => ({
      count: async () => 0,
      all: async () => [],
      first: () => null,
    } as unknown as Locator),
  } as unknown as FilterEngine;

  const tableMapper = {
    getMap: async (): Promise<Map<string, number>> => new Map([['Name', 0]]),
  } as unknown as TableMapper;

  const makeSmartRow = (
    _loc: Locator,
    _map: Map<string, number>,
    idx: number | undefined,
  ): SmartRow => ({ rowIndex: idx, getCell: () => ({}), toJSON: async () => ({}) } as unknown as SmartRow);

  const tableState = { currentPageIndex: 0 };

  // Mirror _advancePage from useTable.ts so tests that configure goNext/goNextBulk work correctly
  const advancePage = async (useBulk: boolean): Promise<boolean> => {
    const pagination = config.strategies.pagination;
    const fakeContext = { root: rootLocator, config, page: rootLocator.page(), resolve: (_: any, p: any) => p } as any;
    let rawResult: boolean | number | undefined;
    if (useBulk && pagination?.goNextBulk) {
      rawResult = await pagination.goNextBulk(fakeContext);
    } else if (pagination?.goNext) {
      rawResult = await pagination.goNext(fakeContext);
    } else if (pagination?.goNextBulk) {
      rawResult = await pagination.goNextBulk(fakeContext);
    } else {
      return false;
    }
    const did = typeof rawResult === 'number' ? rawResult > 0 : !!rawResult;
    if (did) tableState.currentPageIndex += typeof rawResult === 'number' ? rawResult : 1;
    return did;
  };

  return new RowFinder(
    rootLocator,
    config,
    (_item, parent) => parent as Locator,
    filterEngine,
    tableMapper,
    makeSmartRow,
    tableState,
    advancePage,
  );
}

describe('RowFinder pagination delay call sites', () => {
  beforeEach(() => {
    debugDelaySpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── findRows ──────────────────────────────────────────────────────────────

  it('findRows calls debugDelay("pagination") once per page advance', async () => {
    let advances = 0;
    const config = makeConfig({
      strategies: {
        pagination: {
          goNext: async () => { advances++; return advances < 2; },
        },
      } as TableStrategies,
    });

    await makeRowFinder(config).findRows({});

    const calls = debugDelaySpy.mock.calls.filter(([, action]) => action === 'pagination');
    expect(calls.length).toBe(1);
  });

  it('findRows calls debugDelay("pagination") for each of multiple page advances', async () => {
    let advances = 0;
    const config = makeConfig({
      maxPages: 4,
      strategies: {
        pagination: {
          goNext: async () => { advances++; return advances < 3; },
        },
      } as TableStrategies,
    });

    await makeRowFinder(config).findRows({});

    const calls = debugDelaySpy.mock.calls.filter(([, action]) => action === 'pagination');
    expect(calls.length).toBe(2);
  });

  it('findRows does not call debugDelay("pagination") when no pagination strategy', async () => {
    const config = makeConfig({ strategies: {} as TableStrategies });
    await makeRowFinder(config).findRows({});

    const calls = debugDelaySpy.mock.calls.filter(([, action]) => action === 'pagination');
    expect(calls.length).toBe(0);
  });

  // ─── findRow (exercises findRowLocator) ────────────────────────────────────

  it('findRow calls debugDelay("pagination") once when row not found after one page advance', async () => {
    let advances = 0;
    const config = makeConfig({
      strategies: {
        pagination: {
          goNext: async () => { advances++; return advances < 2; },
        },
      } as TableStrategies,
    });

    await makeRowFinder(config).findRow({});

    const calls = debugDelaySpy.mock.calls.filter(([, action]) => action === 'pagination');
    expect(calls.length).toBe(1);
  });

  it('findRow calls debugDelay("pagination") for each of multiple page advances', async () => {
    let advances = 0;
    const config = makeConfig({
      maxPages: 4,
      strategies: {
        pagination: {
          goNext: async () => { advances++; return advances < 3; },
        },
      } as TableStrategies,
    });

    await makeRowFinder(config).findRow({});

    const calls = debugDelaySpy.mock.calls.filter(([, action]) => action === 'pagination');
    expect(calls.length).toBe(2);
  });

  it('findRow does not call debugDelay("pagination") when no pagination strategy', async () => {
    const config = makeConfig({ strategies: {} as TableStrategies });
    await makeRowFinder(config).findRow({});

    const calls = debugDelaySpy.mock.calls.filter(([, action]) => action === 'pagination');
    expect(calls.length).toBe(0);
  });
});
