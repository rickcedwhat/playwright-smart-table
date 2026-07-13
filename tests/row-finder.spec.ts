import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

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

test.describe('getRow() — rowIndex', () => {
  test('returns undefined rowIndex (sync path cannot compute real index)', async ({ page }) => {
    await page.setContent(SIMPLE_TABLE_HTML);
    const table = await useTable(page.locator('#t')).init();

    const carol = table.getRow({ Name: 'Carol' });
    expect(carol.rowIndex).toBeUndefined();

    const eve = table.getRow({ Name: 'Eve' });
    expect(eve.rowIndex).toBeUndefined();
  });
});

test.describe('findRow() — rowIndex', () => {
  test('returns the correct rowIndex for a non-first match', async ({ page }) => {
    await page.setContent(SIMPLE_TABLE_HTML);
    const table = await useTable(page.locator('#t')).init();

    const dave = await table.findRow({ Name: 'Dave' });
    expect(dave.rowIndex).toBe(3);
  });

  // #350: resolveRowIndex now resolves position via a single evaluateAll roundtrip
  // instead of an O(n) elementHandle() loop. Behavior must be unchanged across
  // first/middle/last positions.
  test('resolves rowIndex for first, middle, and last rows', async ({ page }) => {
    await page.setContent(SIMPLE_TABLE_HTML);
    const table = await useTable(page.locator('#t')).init();

    expect((await table.findRow({ Name: 'Alice' })).rowIndex).toBe(0);
    expect((await table.findRow({ Name: 'Carol' })).rowIndex).toBe(2);
    expect((await table.findRow({ Name: 'Eve' })).rowIndex).toBe(4);
  });
});

test.describe('findRows() — pagination flag', () => {
  test('calls goNext (not goNextBulk) when useBulkPagination: false', async ({ page }) => {
    await page.setContent(SIMPLE_TABLE_HTML);

    let goNextCalled = 0;
    let goNextBulkCalled = 0;

    const table = await useTable(page.locator('#t'), {
      maxPages: 2,
      strategies: {
        pagination: {
          goNext: async () => { goNextCalled++; return false; },
          goNextBulk: async () => { goNextBulkCalled++; return false; },
        },
      },
    }).init();

    await table.findRows({}, { useBulkPagination: false });

    expect(goNextBulkCalled).toBe(0);
    expect(goNextCalled).toBe(1);
  });
});
