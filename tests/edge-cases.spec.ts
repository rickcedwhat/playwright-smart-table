import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';
import { Strategies } from '../src/index';
import { createSmartRow } from '../src/smartRow';
import type { FinalTableConfig } from '../src/types';

test.describe('Edge cases and missing coverage', () => {

  test('table has expected core methods', async ({ page }) => {
    await page.setContent(`
      <table id="t"><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
    `);
    const table = useTable(page.locator('#t'));
    expect(table).toHaveProperty('getRow');
    expect(table).toHaveProperty('getRowByIndex');
    expect(table).toHaveProperty('getHeaders');
    expect(table).toHaveProperty('getHeaderCell');
    expect(table).toHaveProperty('reset');
    expect(table).toHaveProperty('findRow');
    expect(table).toHaveProperty('findRows');
  });

  test('init with timeout waits for table to appear', async ({ page }) => {
    await page.setContent('<div id="container"></div>');
    const table = useTable(page.locator('#test-table'));
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    delay(500).then(() =>
      page.setContent(`
        <table id="test-table">
          <thead><tr><th>Name</th></tr></thead>
          <tbody><tr><td>John</td></tr></tbody>
        </table>
      `)
    );
    await table.init({ timeout: 5000 });
    const row = table.getRow({ Name: 'John' });
    await expect(row).toBeVisible();
  });

  test('init chaining works', async ({ page }) => {
    await page.setContent(`
      <table id="test-table">
        <thead><tr><th>Name</th></tr></thead>
        <tbody><tr><td>John</td></tr></tbody>
      </table>
    `);
    const table = await useTable(page.locator('#test-table')).init();
    const row = table.getRow({ Name: 'John' });
    await expect(row).toBeVisible();
  });

  test('getRow works when table appears later (lazy load)', async ({ page }) => {
    await page.setContent('<div id="container"></div>');
    const table = useTable(page.locator('#my-table'));
    await page.setContent(`
      <table id="my-table">
        <thead><tr><th>Name</th><th>Age</th></tr></thead>
        <tbody><tr><td>John</td><td>30</td></tr></tbody>
      </table>
    `);
    await table.init();
    const row = table.getRow({ Name: 'John' });
    await expect(row.getCell('Name')).toHaveText('John');
    await expect(row.getCell('Age')).toHaveText('30');
    await expect(row).toBeVisible();
    await page.evaluate(() => document.querySelector('#my-table tbody tr')?.remove());
    await expect(row).not.toBeVisible();
  });

  test('getRow vs findRow: current page only vs cross-page', async ({ page }) => {
    await page.setContent(`
      <table id="my-table">
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody id="tbody">
          <tr><td>1</td><td>Alice</td></tr>
          <tr><td>2</td><td>Bob</td></tr>
        </tbody>
        <tfoot><tr><td><button id="next">Next</button></td></tr></tfoot>
      </table>
      <script>
        let pageNum = 1;
        document.getElementById('next').onclick = () => {
          if (pageNum === 1) {
            pageNum = 2;
            document.getElementById('tbody').innerHTML = '<tr><td>3</td><td>Carol</td></tr><tr><td>4</td><td>Dave</td></tr>';
          }
        };
      </script>
    `);
    const table = useTable(page.locator('#my-table'), {
      strategies: { pagination: Strategies.Pagination.click({ next: '#next' }) },
      maxPages: 2,
    });
    await table.init();
    await expect(table.getRow({ Name: 'Carol' })).not.toBeVisible();
    await expect(table.getRow({ Name: 'Alice' })).toBeVisible();
    const row = await table.findRow({ Name: 'Carol' });
    await expect(row).toBeVisible();
  });

  test('bringIntoView() throws when row index is unknown', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>Name</th></tr></thead>
        <tbody>
          <tr><td>Alice</td></tr>
          <tr><td>Bob</td></tr>
        </tbody>
      </table>
    `);
    const root = page.locator('#t');
    const table = useTable(root, { headerSelector: 'thead th', rowSelector: 'tbody tr', cellSelector: 'td' });
    await table.init();

    const headers = await table.getHeaders();
    const map = new Map(headers.map((h, i) => [h, i]));
    const rowLocator = root.locator('tbody tr').first();
    const config: FinalTableConfig = {
      headerSelector: 'thead th',
      rowSelector: 'tbody tr',
      cellSelector: 'td',
      maxPages: 1,
      autoScroll: true,
      headerTransformer: ({ text }) => text,
      onReset: async () => {},
      strategies: {},
    };
    const resolve = (sel: string, parent: any) => parent.locator(sel);
    const rowWithUnknownIndex = createSmartRow(rowLocator, map, undefined, config, root, resolve, table, undefined);

    let thrown: Error | null = null;
    try {
      await rowWithUnknownIndex.bringIntoView();
    } catch (e) {
      thrown = e as Error;
    }
    expect(thrown).not.toBeNull();
    expect(thrown!.message).toMatch(/row index is unknown|Cannot bring row into view/);
  });

  test('revalidate() with no DOM change leaves headers unchanged', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>A</th><th>B</th></tr></thead>
        <tbody><tr><td>1</td><td>2</td></tr></tbody>
      </table>
    `);
    const table = useTable(page.locator('#t'));
    await table.init();
    const before = await table.getHeaders();
    await table.revalidate();
    const after = await table.getHeaders();
    expect(after).toEqual(before);
  });

  test('revalidate() picks up new columns after DOM change', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr id="h"><th>A</th></tr></thead>
        <tbody><tr><td>1</td></tr></tbody>
      </table>
    `);
    const table = useTable(page.locator('#t'));
    await table.init();
    expect(await table.getHeaders()).toEqual(['A']);

    await page.evaluate(() => {
      document.querySelector('#h')!.innerHTML += '<th>B</th>';
      document.querySelector('tbody tr')!.innerHTML += '<td>2</td>';
    });
    expect(await table.getHeaders()).toEqual(['A']);

    await table.revalidate();
    expect(await table.getHeaders()).toEqual(['A', 'B']);
    const row = table.getRowByIndex(0);
    await expect(row.getCell('B')).toHaveText('2');
  });

  test('init({ timeout }) fails when headers stay loading within timeout', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>X</th></tr></thead>
        <tbody><tr><td>1</td></tr></tbody>
      </table>
    `);
    const table = useTable(page.locator('#t'), {
      headerSelector: 'thead th',
      strategies: {
        loading: { isHeaderLoading: async () => true },
      },
    });
    await expect(table.init({ timeout: 300 })).rejects.toThrow(/Timed out|headers/);
  });

  test('getRowByIndex out-of-range returns locator that is not visible', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>ID</th></tr></thead>
        <tbody><tr><td>1</td></tr></tbody>
      </table>
    `);
    const table = useTable(page.locator('#t'));
    await table.init();

    const row = table.getRowByIndex(999);
    await expect(row).not.toBeVisible();
  });

  test('reset() calls goToFirst and clears currentPageIndex', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>ID</th></tr></thead>
        <tbody id="tbody">
          <tr><td>1</td></tr>
          <tr><td>2</td></tr>
        </tbody>
        <tfoot><tr><td><button id="first">First</button><button id="next">Next</button></td></tr></tfoot>
      </table>
      <div id="page">1</div>
      <script>
        let p = 1;
        function render() {
          if (p === 1) {
            document.getElementById('tbody').innerHTML = '<tr><td>1</td></tr><tr><td>2</td></tr>';
            document.getElementById('page').textContent = '1';
          } else {
            document.getElementById('tbody').innerHTML = '<tr><td>3</td></tr><tr><td>4</td></tr>';
            document.getElementById('page').textContent = '2';
          }
        }
        document.getElementById('next').onclick = () => { if (p === 1) { p = 2; render(); } };
        document.getElementById('first').onclick = () => { if (p === 2) { p = 1; render(); } };
      </script>
    `);
    const table = useTable(page.locator('#t'), {
      strategies: { pagination: Strategies.Pagination.click({ next: '#next', first: '#first' }) },
      maxPages: 2,
    });
    await table.init();
    await table.findRows({});
    expect(table.currentPageIndex).toBe(1);
    await table.reset();
    expect(table.currentPageIndex).toBe(0);
    await expect(page.locator('#page')).toHaveText('1');
  });

  test('sorting.getState throws when no sorting strategy configured', async ({ page }) => {
    await page.setContent(`
      <table id="t"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Alice</td></tr></tbody></table>
    `);
    const table = useTable(page.locator('#t'));
    await table.init();
    await expect(table.sorting.getState('Name')).rejects.toThrow(/No sorting strategy/);
  });

  test('sorting.apply throws when no sorting strategy configured', async ({ page }) => {
    await page.setContent(`
      <table id="t"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Alice</td></tr></tbody></table>
    `);
    const table = useTable(page.locator('#t'));
    await table.init();
    await expect(table.sorting.apply('Name', 'asc')).rejects.toThrow(/No sorting strategy/);
  });

  test('scrollToColumn brings column header into view', async ({ page }) => {
    await page.setContent(`
      <div style="width: 200px; overflow-x: auto;">
        <table id="t">
          <thead><tr>
            <th style="min-width: 150px">Col1</th>
            <th style="min-width: 150px">Col2</th>
            <th style="min-width: 150px">Col3</th>
          </tr></thead>
          <tbody><tr><td>A</td><td>B</td><td>C</td></tr></tbody>
        </table>
      </div>
    `);
    const table = useTable(page.locator('#t'));
    await table.init();
    const headerCell = await table.getHeaderCell('Col3');
    await expect(headerCell).not.toBeInViewport();
    await table.scrollToColumn('Col3');
    await expect(headerCell).toBeInViewport();
  });

  test('getRow with exact: true matches only exact cell text', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>Name</th></tr></thead>
        <tbody>
          <tr><td>John</td></tr>
          <tr><td>John Doe</td></tr>
        </tbody>
      </table>
    `);
    const table = useTable(page.locator('#t'));
    await table.init();
    const exactRow = table.getRow({ Name: 'John' }, { exact: true });
    await expect(exactRow).toHaveText('John');
    const partialRow = table.getRow({ Name: 'John' }, { exact: false });
    await expect(partialRow).toBeVisible();
  });

  test('findRow with maxPages: 1 returns sentinel when row is on later page', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody id="tb">
          <tr><td>1</td><td>Alice</td></tr>
          <tr><td>2</td><td>Bob</td></tr>
        </tbody>
        <tfoot><tr><td><button id="next">Next</button></td></tr></tfoot>
      </table>
      <script>
        let p = 1;
        document.getElementById('next').onclick = () => {
          if (p === 1) {
            p = 2;
            document.getElementById('tb').innerHTML = '<tr><td>3</td><td>Carol</td></tr><tr><td>4</td><td>Dave</td></tr>';
          }
        };
      </script>
    `);
    const table = useTable(page.locator('#t'), {
      strategies: { pagination: Strategies.Pagination.click({ next: '#next' }) },
      maxPages: 3,
    });
    await table.init();
    const missing = await table.findRow({ Name: 'Carol' }, { maxPages: 1 });
    await expect(missing).not.toBeVisible();
    const found = await table.findRow({ Name: 'Carol' }, { maxPages: 2 });
    await expect(found).toBeVisible();
  });

  test('columnOverrides.read only: toJSON uses custom read for column', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>Name</th><th>Score</th></tr></thead>
        <tbody>
          <tr><td>Alice</td><td><span data-value="100">100 pts</span></td></tr>
        </tbody>
      </table>
    `);
    const table = useTable(page.locator('#t'), {
      columnOverrides: {
        Score: {
          read: async (cell) => {
            const el = await cell.locator('[data-value]').getAttribute('data-value');
            return el ? parseInt(el, 10) : 0;
          },
        },
      },
    });
    await table.init();
    const row = table.getRowByIndex(0);
    const data = await row.toJSON();
    expect(data.Score).toBe(100);
    expect(data.Name).toBe('Alice');
  });

  test('beforeCellRead hook is called during toJSON', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>A</th><th>B</th></tr></thead>
        <tbody><tr><td>1</td><td>2</td></tr></tbody>
      </table>
    `);
    let beforeCellReadCalls = 0;
    const table = useTable(page.locator('#t'), {
      strategies: {
        beforeCellRead: async () => {
          beforeCellReadCalls++;
        },
      },
    });
    await table.init();
    const row = table.getRowByIndex(0);
    await row.toJSON();
    expect(beforeCellReadCalls).toBe(2);
  });
});
