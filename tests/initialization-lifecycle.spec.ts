import { test, expect } from '@playwright/test';
import { useTable, type TableConfig } from '../src';

const html = '<table data-page="2"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Alice</td></tr></tbody></table>';
for (const entry of ['findRow', 'findRows', 'map', 'countRows', 'findRowByIndex', 'getHeaders', 'getHeaderCell', 'scrollToColumn', 'iterator'] as const) {
  test(`${entry} detects the starting page before later explicit init`, async ({ page }) => {
    await page.setContent(html);
    let detections = 0;
    const table = useTable(page.locator('table'), {
      autoScroll: false,
      strategies: {
        loading: {}, resolveRowIndex: async () => 0,
        pagination: { detectCurrentPage: async root => { detections++; return Number(await root.getAttribute('data-page')); } },
      },
    });
    if (entry === 'findRow') expect((await table.findRow({ Name: 'Alice' })).tablePageIndex).toBe(2);
    if (entry === 'findRows') expect((await table.findRows())[0].tablePageIndex).toBe(2);
    if (entry === 'map') expect(await table.map(({ pageIndex }) => pageIndex)).toEqual([2]);
    if (entry === 'countRows') expect(await table.countRows()).toBe(1);
    if (entry === 'findRowByIndex') expect((await table.findRowByIndex(0)).tablePageIndex).toBe(2);
    if (entry === 'getHeaders') expect(await table.getHeaders()).toEqual(['Name']);
    if (entry === 'getHeaderCell') expect(await (await table.getHeaderCell('Name')).innerText()).toBe('Name');
    if (entry === 'scrollToColumn') await table.scrollToColumn('Name');
    if (entry === 'iterator') { for await (const item of table) expect(item.pageIndex).toBe(2); }
    await table.init();
    expect(detections).toBe(1);
    expect(table.currentPageIndex).toBe(2);
    expect(table.isInitialized()).toBe(true);
  });
}

test('concurrent callers share initialization and wait for page detection', async ({ page }) => {
  await page.setContent(html);
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const started = new Promise<void>(r => { entered = r; });
  let detections = 0;
  const table = useTable(page.locator('table'), { strategies: {
    loading: {}, pagination: { detectCurrentPage: async () => { detections++; entered(); await gate; return 2; } },
  } });
  const initializing = table.init();
  await started;
  expect(table.isInitialized()).toBe(false);
  expect(() => table.getRowByIndex(0)).toThrow('Initialization Error');
  const finding = table.findRow({ Name: 'Alice' });
  const explicit = table.init();
  release();
  await Promise.all([initializing, explicit]);
  expect((await finding).tablePageIndex).toBe(2);
  expect(detections).toBe(1);
});

for (const entry of ['findRow', 'map', 'countRows'] as const) {
  test(`${entry} performs the same strategy validation as init`, async ({ page }) => {
    await page.setContent(html);
    const table = useTable(page.locator('table'), { strategies: { sorting: {} as NonNullable<TableConfig['strategies']>['sorting'] } });
    const operation = entry === 'findRow' ? table.findRow({}) : entry === 'map' ? table.map(() => 1) : table.countRows();
    await expect(operation).rejects.toThrow("Sorting strategy must have a 'doSort' method");
  });
}

test('failed initialization can be retried', async ({ page }) => {
  await page.setContent(html);
  let fail = true;
  let detections = 0;
  const table = useTable(page.locator('table'), { strategies: {
    loading: {}, header: async () => { if (fail) throw new Error('not ready'); return ['Name']; },
    pagination: { detectCurrentPage: async () => { detections++; return 2; } },
  } });
  await expect(table.init({ timeout: 100 })).rejects.toThrow('not ready');
  expect(table.isInitialized()).toBe(false);
  fail = false;
  expect((await table.findRow({ Name: 'Alice' })).tablePageIndex).toBe(2);
  expect(detections).toBe(1);
});

test('automatic count recognizes an empty state and returns zero', async ({ page }) => {
  await page.setContent('<div id="empty">No rows</div>');
  const table = useTable(page.locator('table'), { emptyState: page.locator('#empty') });
  expect(await table.countRows()).toBe(0);
  expect(table.isEmpty()).toBe(true);
  expect(table.isInitialized()).toBe(true);
  await expect(table.map(() => 1)).rejects.toThrow('No column map');
});

test('detector can read mapped headers without recursive initialization', async ({ page }) => {
  await page.setContent(html);
  const table = useTable(page.locator('table'), { strategies: {
    loading: {}, pagination: { detectCurrentPage: async () => { expect(await table.getHeaders()).toEqual(['Name']); return 2; } },
  } });
  await table.init();
  expect(table.currentPageIndex).toBe(2);
});

for (const entry of ['findRow', 'findRows', 'map', 'countRows'] as const) {
  test(`${entry} advances relative to detected page and count restores page zero`, async ({ page }) => {
    await page.setContent(html);
    let actualPage = 2;
    let detections = 0;
    const table = useTable(page.locator('table'), { maxPages: 2, autoScroll: false, strategies: {
      loading: {}, pagination: {
        detectCurrentPage: async () => { detections++; return actualPage; },
        goNext: async () => {
          if (actualPage >= 3) return false;
          actualPage++;
          await page.locator('td').evaluate(el => { el.textContent = 'Bob'; });
          return true;
        },
        goToFirst: async () => { actualPage = 0; await page.locator('td').evaluate(el => { el.textContent = 'Alice'; }); },
      },
    } });
    if (entry === 'findRow') expect((await table.findRow({ Name: 'Bob' })).tablePageIndex).toBe(3);
    if (entry === 'findRows') expect((await table.findRows()).map(row => row.tablePageIndex)).toEqual([2, 3]);
    if (entry === 'map') expect(await table.map(({ pageIndex }) => pageIndex)).toEqual([2, 3]);
    if (entry === 'countRows') {
      expect(await table.countRows()).toBe(2);
      expect(table.currentPageIndex).toBe(0);
      expect(actualPage).toBe(0);
    } else expect(table.currentPageIndex).toBe(3);
    await table.init();
    expect(detections).toBe(entry === 'countRows' ? 2 : 1);
  });
}

for (const entry of ['reset', 'revalidate'] as const) {
  test(`${entry} restores the shared initialization lifecycle`, async ({ page }) => {
    await page.setContent(html);
    let detections = 0;
    const table = useTable(page.locator('table'), { autoScroll: false, strategies: {
      loading: {}, pagination: {
        detectCurrentPage: async root => { detections++; return Number(await root.getAttribute('data-page')); },
        goToFirst: async () => { await page.locator('table').evaluate(el => el.setAttribute('data-page', '0')); },
      },
    } });
    await table.init();
    await page.locator('table').evaluate(el => el.setAttribute('data-page', '4'));
    await table[entry]();
    expect(table.currentPageIndex).toBe(entry === 'reset' ? 0 : 4);
    expect(table.isInitialized()).toBe(true);
    await table.init();
    expect(detections).toBe(2);
  });
}
