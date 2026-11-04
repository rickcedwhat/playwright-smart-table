import { test, expect, type Page } from '@playwright/test';
import { useTable, type PaginationPrimitives } from '../src';

type Rewind = 'absent' | 'false' | 'true' | 'legacy' | 'throws';
type Detector = 'none' | 'valid' | 'invalid' | 'throws';
async function setup(page: Page, rewind: Rewind, detector: Detector = 'none') {
  await page.setContent('<table data-page="0"><thead><tr><th>Page</th></tr></thead><tbody><tr><td>0</td></tr></tbody></table>');
  const actualPage = async () => Number(await page.locator('table').getAttribute('data-page'));
  const setPage = async (n: number) => page.locator('table').evaluate((el, n) => {
    el.setAttribute('data-page', String(n));
    el.querySelector('td')!.textContent = String(n);
  }, n);
  let scans = 0;
  let hook: { page: number; headers: string[] } | undefined;
  const goToFirst = rewind === 'absent' ? undefined : (async () => {
    if (rewind === 'throws') throw new Error('rewind failed');
    if (rewind === 'false') return false;
    await setPage(0);
    // Compatibility with existing JS action-only callbacks, despite the boolean TS contract.
    return rewind === 'legacy' ? undefined : true;
  }) as PaginationPrimitives['goToFirst'];
  const table = useTable(page.locator('table'), { maxPages: 3, strategies: {
    loading: {}, header: async ({ root }) => { scans++; return root.locator('th').allInnerTexts(); },
    pagination: {
      goNext: async () => { const n = await actualPage(); if (n >= 2) return false; await setPage(n + 1); return true; },
      goToFirst,
      ...(detector === 'none' ? {} : { detectCurrentPage: async () => {
        if (detector === 'throws') throw new Error('detector failed');
        return detector === 'invalid' ? -1 : actualPage();
      } }),
    },
  }, onReset: async () => { hook = { page: table.currentPageIndex, headers: await table.getHeaders() }; } });
  return { table, actualPage, scans: () => scans, hook: () => hook };
}
for (const rewind of ['absent', 'false', 'true'] as const) {
  for (const detector of ['none', 'valid', 'invalid', 'throws'] as const) {
    test(`reset with ${rewind} rewind and ${detector} detector keeps page metadata aligned`, async ({ page }) => {
      const { table, actualPage, scans, hook } = await setup(page, rewind, detector);
      expect(await table.map(({ pageIndex }) => pageIndex)).toEqual([0, 1, 2]);
      expect(table.currentPageIndex).toBe(2);
      await table.reset();
      const actual = await actualPage();
      expect(actual).toBe(rewind === 'true' ? 0 : 2);
      expect(table.currentPageIndex).toBe(actual);
      expect(await table.map(({ pageIndex }) => pageIndex, { maxPages: 1 })).toEqual([actual]);
      expect((await table.findRow({ Page: String(actual) })).tablePageIndex).toBe(actual);
      expect(scans()).toBe(2);
      expect(hook()).toEqual({ page: actual, headers: ['Page'] });
      expect(table.isInitialized()).toBe(true);
    });
  }
}

test('legacy action-only rewind callbacks still establish page zero', async ({ page }) => {
  const { table, actualPage } = await setup(page, 'legacy');
  await table.map(() => null);
  await table.reset();
  expect(await actualPage()).toBe(0);
  expect(table.currentPageIndex).toBe(0);
});

test('throwing rewind preserves the known page and propagates the error', async ({ page }) => {
  const { table, actualPage, hook } = await setup(page, 'throws');
  await table.map(() => null);
  await expect(table.reset()).rejects.toThrow('rewind failed');
  expect(await actualPage()).toBe(2);
  expect(table.currentPageIndex).toBe(2);
  expect(hook()).toBeUndefined();
});
for (const method of ['countRows', 'toArray'] as const) {
  for (const rewind of ['absent', 'false'] as const) {
    test(`${method} cleanup does not invent a first page after ${rewind} rewind`, async ({ page }) => {
      const { table, actualPage } = await setup(page, rewind);
      if (method === 'countRows') expect(await table.countRows()).toBe(3);
      else expect(await table.toArray(({ pageIndex }) => pageIndex)).toEqual([0, 1, 2]);
      expect(await actualPage()).toBe(2);
      expect(table.currentPageIndex).toBe(2);
      expect(await table.map(({ pageIndex }) => pageIndex, { maxPages: 1 })).toEqual([2]);
    });
  }
}
