/**
 * Regression tests for bugs found via the GBU review flow.
 * Each test is named with its issue number and is written to FAIL against the
 * buggy code and PASS once the fix is applied.
 */
import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

// ─── Shared HTML fixtures ─────────────────────────────────────────────────────

const SIMPLE_TABLE_HTML = `
  <table id="t">
    <thead><tr><th>Name</th></tr></thead>
    <tbody>
      <tr><td>Alice</td></tr>
      <tr><td>Bob</td></tr>
      <tr><td>Carol</td></tr>
      <tr><td>Dave</td></tr>
      <tr><td>Eve</td></tr>
    </tbody>
  </table>
`;

// ─── Bug #103: getRow() / findRow() always assign rowIndex: 0 ─────────────────

test.describe('Bug #103: rowIndex is 0 for every matched row', () => {
  test('getRow() returns the correct rowIndex for a non-first match', async ({ page }) => {
    await page.setContent(SIMPLE_TABLE_HTML);
    const table = await useTable(page.locator('#t')).init();

    const carol = table.getRow({ Name: 'Carol' });
    expect(carol.rowIndex).toBeUndefined(); // sync path cannot compute real index

    const eve = table.getRow({ Name: 'Eve' });
    expect(eve.rowIndex).toBeUndefined();
  });

  test('findRow() returns the correct rowIndex for a non-first match', async ({ page }) => {
    await page.setContent(SIMPLE_TABLE_HTML);
    const table = await useTable(page.locator('#t')).init();

    const dave = await table.findRow({ Name: 'Dave' });
    expect(dave.rowIndex).toBe(3);
  });
});

// ─── Bug #100: validateSortingStrategy / validateFillStrategy never called ────

test.describe('Bug #100: malformed strategies only fail at call-time, not at init()', () => {
  test('init() throws early for a sorting strategy missing getSortState', async ({ page }) => {
    await page.setContent(SIMPLE_TABLE_HTML);

    const table = useTable(page.locator('#t'), {
      strategies: {
        sorting: { doSort: async () => {} } as any, // getSortState intentionally absent
      },
    });

    // Should throw during init(), not silently succeed then blow up on first sort
    await expect(table.init()).rejects.toThrow(/getSortState/);
  });

  test('init() throws early for a fill strategy that is not a function', async ({ page }) => {
    await page.setContent(SIMPLE_TABLE_HTML);

    const table = useTable(page.locator('#t'), {
      strategies: {
        fill: { someKey: true } as any,
      },
    });

    await expect(table.init()).rejects.toThrow(/Fill strategy must be a function/);
  });
});

// ─── Bug #101: findRows() ignores useBulkPagination, always prefers goNextBulk ─

test.describe('Bug #101: findRows() always uses goNextBulk even when bulk is disabled', () => {
  test('findRows() calls goNext (not goNextBulk) when useBulkPagination: false', async ({ page }) => {
    await page.setContent(SIMPLE_TABLE_HTML);

    let goNextCalled = 0;
    let goNextBulkCalled = 0;

    const table = await useTable(page.locator('#t'), {
      maxPages: 2,
      strategies: {
        pagination: {
          goNext: async () => { goNextCalled++; return false; },      // single-page step
          goNextBulk: async () => { goNextBulkCalled++; return false; }, // bulk step
        },
      },
    }).init();

    // Pass useBulkPagination: false — findRows should prefer goNext
    await table.findRows({}, { useBulkPagination: false } as any);

    expect(goNextBulkCalled).toBe(0);
    expect(goNextCalled).toBe(1);
  });
});

// ─── Bug #99: sorting stabilization polls isTableLoading once, result ignored ─

test.describe('Bug #99: sorting.apply() calls isTableLoading once instead of looping', () => {
  test('sorting.apply() polls isTableLoading until it returns false before checking sort state', async ({ page }) => {
    await page.setContent(SIMPLE_TABLE_HTML);

    let isLoadingCallCount = 0;
    let doSortCallCount = 0;

    const table = await useTable(page.locator('#t'), {
      strategies: {
        sorting: {
          // doSort completes immediately, but the table only "appears sorted"
          // after isTableLoading has been called at least 3 times
          doSort: async () => { doSortCallCount++; },
          getSortState: async () => (isLoadingCallCount >= 3 ? 'asc' : 'none'),
        },
        loading: {
          // Simulates a slow render: busy for the first two calls, done on the third
          isTableLoading: async () => {
            isLoadingCallCount++;
            return isLoadingCallCount < 3;
          },
        },
      },
    }).init();

    await table.sorting.apply('Name', 'asc');

    // With the fix: isTableLoading is polled until false → doSort runs exactly once
    // With the bug: isTableLoading is called once per retry → doSort runs 3 times
    expect(doSortCallCount).toBe(1);
    expect(isLoadingCallCount).toBeGreaterThanOrEqual(3);
  });
});
