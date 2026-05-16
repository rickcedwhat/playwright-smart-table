/**
 * Verifies that debugDelay is called with the 'pagination' action type after
 * each successful page advance in RowFinder.findRows and findRowLocator (via
 * findRow). Kept in its own file so we can mock debugUtils without affecting
 * tests that exercise the real debugDelay implementation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
import * as debugUtils from '../../src/utils/debugUtils';
import type { FinalTableConfig } from '../../src/types';

const debugDelaySpy = debugUtils.debugDelay as ReturnType<typeof vi.fn>;

function makeConfig(overrides: Partial<FinalTableConfig> = {}): FinalTableConfig {
  return {
    rowSelector: 'tr',
    headerSelector: 'th',
    cellSelector: 'td',
    maxPages: 3,
    autoScroll: false,
    headerTransformer: ({ text }: any) => text,
    onReset: async () => {},
    strategies: {},
    ...overrides,
  } as any;
}

function makeRowFinder(config: FinalTableConfig) {
  const rootLocator: any = {
    all: async () => [],
    count: async () => 0,
    filter: function() { return this; },
    first: () => null,
    page: () => ({ waitForTimeout: async () => {} }),
  };

  const filterEngine: any = {
    applyFilters: () => ({ count: async () => 0, all: async () => [], first: () => null }),
  };

  const tableMapper: any = {
    getMap: async () => new Map([['Name', 0]]),
  };

  const makeSmartRow = (_loc: any, _map: any, idx: number) =>
    ({ rowIndex: idx, getCell: () => ({}), toJSON: async () => ({}) } as any);

  return new RowFinder(
    rootLocator,
    config,
    (_item: any, parent: any) => parent,
    filterEngine,
    tableMapper,
    makeSmartRow
  );
}

describe('RowFinder pagination delay call sites', () => {
  beforeEach(() => {
    debugDelaySpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('findRows calls debugDelay("pagination") once per page advance', async () => {
    let advances = 0;
    const config = makeConfig({
      strategies: {
        pagination: {
          goNext: async () => {
            advances++;
            return advances < 2; // advance once then stop
          },
        },
      },
    } as any);

    await makeRowFinder(config).findRows({});

    const paginationCalls = debugDelaySpy.mock.calls.filter(
      ([, action]) => action === 'pagination'
    );
    expect(paginationCalls.length).toBe(1);
  });

  it('findRows calls debugDelay("pagination") for each of multiple page advances', async () => {
    let advances = 0;
    const config = makeConfig({
      maxPages: 4,
      strategies: {
        pagination: {
          goNext: async () => {
            advances++;
            return advances < 3; // advance twice then stop
          },
        },
      },
    } as any);

    await makeRowFinder(config).findRows({});

    const paginationCalls = debugDelaySpy.mock.calls.filter(
      ([, action]) => action === 'pagination'
    );
    expect(paginationCalls.length).toBe(2);
  });

  it('findRows does not call debugDelay("pagination") when no pagination strategy', async () => {
    const config = makeConfig({ strategies: {} } as any);
    await makeRowFinder(config).findRows({});

    const paginationCalls = debugDelaySpy.mock.calls.filter(
      ([, action]) => action === 'pagination'
    );
    expect(paginationCalls.length).toBe(0);
  });
});
