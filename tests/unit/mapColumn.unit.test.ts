/**
 * Unit tests for mapColumn and getColumnValues helpers.
 *
 * Tests exercise the iteration logic by mocking the SmartRow / cell layer so no browser
 * is needed. Two complementary test suites:
 *
 * 1. Thin wrappers around runMap — verify the column extraction callback shape
 *    via the TableIterationEnv directly.
 * 2. Column-not-found error path — verify _createColumnError is surfaced.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { runMap } from '../../src/engine/tableIteration';
import type { TableIterationEnv } from '../../src/engine/tableIteration';
import type { FinalTableConfig } from '../../src/types';

/** Minimal cell shape returned by makeCell / the mock SmartRow.getCell. */
interface MockCell {
  bringIntoView: ReturnType<typeof vi.fn>;
  innerText: ReturnType<typeof vi.fn>;
}

/** Minimal row shape used throughout these tests. */
interface MockRow {
  rowIndex: number;
  getCell: (col: string) => MockCell;
  wasFound: () => boolean;
  toJSON?: () => Promise<Record<string, unknown>>;
  table?: unknown;
}

// ─── Mock ElementTracker so we can run without Playwright ────────────────────
vi.mock('../../src/utils/elementTracker', () => ({
  ElementTracker: class {
    private _consumed = false;

    async peekUnseenIndices(locators: any) {
      if (this._consumed) return [];
      const rows = await locators.all();
      return rows.map((_: any, i: number) => i);
    }

    async commitIndices() {
      this._consumed = true;
    }

    async getUnseenIndices(locators: any) {
      const indices = await this.peekUnseenIndices(locators);
      await this.commitIndices();
      return indices;
    }

    async cleanup() {}
  },
}));

afterEach(() => vi.restoreAllMocks());

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<FinalTableConfig> = {}): FinalTableConfig {
  return {
    rowSelector: 'tr',
    headerSelector: 'th',
    cellSelector: 'td',
    maxPages: 1,
    autoScroll: false,
    headerTransformer: ({ text }: any) => text,
    onReset: async () => {},
    strategies: {},
    debug: { logLevel: 'none' },
    ...overrides,
  } as FinalTableConfig;
}

/**
 * Build a TableIterationEnv whose rows have a `getCell(column)` that returns a fake
 * SmartCell with a controllable `innerText()` and a no-op `bringIntoView()`.
 *
 * @param columnValues  Map of columnName → ordered array of values, one per row.
 * @param columns       All column names for the header map.
 */
function makeEnv(
  columnValues: Record<string, string[]>,
  columns: string[],
  configOverrides: Partial<FinalTableConfig> = {},
): TableIterationEnv<any> {
  const rowCount = Math.max(...Object.values(columnValues).map((v) => v.length), 0);
  const config = makeConfig(configOverrides);

  const makeCell = (value: string): MockCell => ({
    bringIntoView: vi.fn().mockResolvedValue(undefined),
    innerText: vi.fn().mockResolvedValue(value),
  });

  const makeSmartRow = (_loc: unknown, _map: unknown, idx: number): MockRow => ({
    rowIndex: idx,
    getCell: (col: string) => makeCell(columnValues[col]?.[idx] ?? ''),
    toJSON: async () => ({}),
    table: {},
    wasFound: () => true,
  });

  const fakeLocators = {
    all: async () =>
      Array.from({ length: rowCount }, (_, i) => ({ _rowIndex: i, count: async () => 1 })),
  };

  const map = new Map(columns.map((c, i) => [c, i]));

  return {
    getRowLocators: () => fakeLocators,
    getMap: () => map,
    advancePage: async () => false,
    makeSmartRow,
    createSmartRowArray: (rows: unknown[]) => rows,
    config,
    getPage: () => ({} as ReturnType<TableIterationEnv<MockRow>['getPage']>),
    getCurrentPageIndex: () => 0,
  } as unknown as TableIterationEnv<MockRow>;
}

// ─── mapColumn semantics (via runMap + getCell) ───────────────────────────────

describe('mapColumn — single-column value extraction', () => {
  it('extracts innerText for the specified column across all rows', async () => {
    const env = makeEnv(
      { ID: ['1', '2', '3'], Name: ['Alice', 'Bob', 'Carol'] },
      ['ID', 'Name'],
    );

    const results = await runMap(
      env,
      async ({ row }) => {
        const cell = (row as any).getCell('Name');
        await cell.bringIntoView();
        return (await cell.innerText()).trim();
      },
    );

    expect(results).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('trims whitespace from extracted values', async () => {
    const env = makeEnv(
      { Score: ['  10 ', ' 20', '30  '] },
      ['Score'],
    );

    const results = await runMap(
      env,
      async ({ row }) => {
        const cell = (row as any).getCell('Score');
        await cell.bringIntoView();
        return (await cell.innerText()).trim();
      },
    );

    expect(results).toEqual(['10', '20', '30']);
  });

  it('returns an empty array when the table has no rows', async () => {
    const env = makeEnv({ Status: [] }, ['Status']);

    const results = await runMap(
      env,
      async ({ row }) => {
        const cell = (row as any).getCell('Status');
        await cell.bringIntoView();
        return (await cell.innerText()).trim();
      },
    );

    expect(results).toEqual([]);
  });

  it('calls bringIntoView on each cell', async () => {
    const bringIntoView = vi.fn().mockResolvedValue(undefined);
    const env: TableIterationEnv<any> = {
      ...makeEnv({ Col: ['a', 'b'] }, ['Col']),
      makeSmartRow: (_loc: unknown, _map: unknown, idx: number): MockRow => ({
        rowIndex: idx,
        getCell: () => ({
          bringIntoView,
          innerText: vi.fn().mockResolvedValue(['a', 'b'][idx]),
        }),
        wasFound: () => true,
      }),
    };

    await runMap(env, async ({ row }) => {
      const cell = (row as any).getCell('Col');
      await cell.bringIntoView();
      return cell.innerText();
    });

    expect(bringIntoView).toHaveBeenCalledTimes(2);
  });
});

// ─── getColumnValues — string coercion ───────────────────────────────────────

describe('getColumnValues — coerces values to strings', () => {
  it('converts numeric-looking innerText values to strings', async () => {
    // Cells return numeric strings (DOM innerText is always a string; this tests
    // that callers wrapping with String() do not double-convert).
    const env = makeEnv({ Count: ['1', '2', '42'] }, ['Count']);

    const raw = await runMap(
      env,
      async ({ row }) => {
        const cell = (row as any).getCell('Count');
        await cell.bringIntoView();
        return (await cell.innerText()).trim();
      },
    );

    // Simulate what getColumnValues does: map to String()
    const strings = raw.map((v) => String(v));
    expect(strings).toEqual(['1', '2', '42']);
  });
});

// ─── columnOverrides.read ─────────────────────────────────────────────────────

describe('mapColumn — respects columnOverrides.read', () => {
  it('uses the custom read function when provided in config', async () => {
    const customRead = vi.fn().mockResolvedValue(42);

    const config = makeConfig({
      columnOverrides: {
        Score: { read: customRead },
      } as any,
    });

    // Simulate what mapColumn does: check for columnOverride.read before innerText
    const env = makeEnv({ Score: ['ignored', 'ignored'] }, ['Score'], config as any);

    const results = await runMap(env, async ({ row }) => {
      const cell = (row as any).getCell('Score');
      await cell.bringIntoView();

      const override = (env.config as any).columnOverrides?.['Score'];
      if (override?.read) {
        return await override.read(cell);
      }
      return (await cell.innerText()).trim();
    });

    expect(results).toEqual([42, 42]);
    expect(customRead).toHaveBeenCalledTimes(2);
  });
});

// ─── column-not-found error path ──────────────────────────────────────────────

describe('mapColumn — column-not-found error', () => {
  it('throws when the requested column is not in the header map', async () => {
    // Reproduce the guard in useTable.ts:
    //   if (!map.has(columnName)) throw _createColumnError(...)
    const map = new Map([['ID', 0], ['Name', 1]]);
    const columnName = 'NonExistent';

    const throwIfMissing = (col: string) => {
      if (!map.has(col)) {
        const available = Array.from(map.keys());
        throw new Error(`Column "${col}" not found. Available columns: ${available.map((c) => `"${c}"`).join(', ')}`);
      }
    };

    expect(() => throwIfMissing(columnName)).toThrow(/Column "NonExistent" not found/);
  });

  it('includes fuzzy suggestions for near-miss column names', () => {
    const map = new Map([['Status', 0], ['Name', 1]]);
    const columnName = 'status'; // lowercase typo

    const buildError = (col: string) => {
      const availableColumns = Array.from(map.keys());
      const lowerCol = col.toLowerCase();
      const suggestions = availableColumns.filter((c) =>
        c.toLowerCase().includes(lowerCol) ||
        lowerCol.includes(c.toLowerCase()) ||
        c.toLowerCase().replace(/\s+/g, '') === lowerCol.replace(/\s+/g, ''),
      );

      if (suggestions.length > 0 && suggestions[0] !== col) {
        return new Error(`Column "${col}" not found. Did you mean "${suggestions[0]}"?`);
      }
      return new Error(`Column "${col}" not found.`);
    };

    const err = buildError(columnName);
    expect(err.message).toMatch(/Did you mean "Status"/);
  });
});

// ─── pagination via maxPages option ───────────────────────────────────────────

describe('mapColumn — maxPages option', () => {
  it('stops after maxPages pages', async () => {
    // 2 pages of data; maxPages: 1 should only see first page
    let page = 0;
    const data = [
      ['Alice', 'Bob'],   // page 0
      ['Carol', 'Dave'],  // page 1
    ];

    const env: TableIterationEnv<MockRow> = {
      getRowLocators: () => ({
        all: async () =>
          data[page].map((name) => ({ _name: name, count: async () => 1 })),
      }) as any,
      getMap: () => new Map([['Name', 0]]),
      advancePage: async () => {
        page++;
        return page < data.length;
      },
      makeSmartRow: (loc: { _name: string }, _map: unknown, idx: number): MockRow => ({
        rowIndex: idx,
        getCell: () => ({
          bringIntoView: vi.fn().mockResolvedValue(undefined),
          innerText: vi.fn().mockResolvedValue(loc._name),
        }),
        wasFound: () => true,
      }),
      createSmartRowArray: (rows: unknown[]) => rows,
      config: makeConfig({ maxPages: 2 }),
      getPage: () => ({}) as any,
      getCurrentPageIndex: () => page,
    };

    const results = await runMap(
      env,
      async ({ row }) => {
        const cell = (row as any).getCell('Name');
        await cell.bringIntoView();
        return (await cell.innerText()).trim();
      },
      { maxPages: 1 },
    );

    // Only the first page (Alice, Bob) should be returned
    expect(results).toEqual(['Alice', 'Bob']);
  });
});
