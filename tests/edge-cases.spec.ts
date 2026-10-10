import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';
import { Strategies } from '../src/index';
test.describe('Edge cases and missing coverage', () => {

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

  test('bringIntoView() on a getRow() row (unknown index) scrolls it into view instead of throwing', async ({ page }) => {
    await page.setContent(`
      <div style="height: 2000px"></div>
      <table id="t">
        <thead><tr><th>Name</th></tr></thead>
        <tbody><tr><td>Alice</td></tr><tr><td>Bob</td></tr></tbody>
      </table>
    `);
    const table = await useTable(page.locator('#t')).init();
    await page.evaluate(() => window.scrollTo(0, 0));
    const row = table.getRow({ Name: 'Bob' });
    await expect(row).not.toBeInViewport();

    await row.bringIntoView();

    expect(row.rowIndex).toBeUndefined();
    await expect(row).toBeInViewport();
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

  test('revalidate() drops columns removed from the DOM', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>A</th><th>B</th></tr></thead>
        <tbody><tr><td>1</td><td>2</td></tr></tbody>
      </table>
    `);
    const table = useTable(page.locator('#t'));
    await table.init();
    expect(await table.getHeaders()).toEqual(['A', 'B']);

    await page.evaluate(() => {
      document.querySelectorAll('#t thead th')[1].remove();
      document.querySelectorAll('#t tbody tr').forEach((r) => {
        const td = r.querySelectorAll('td')[1];
        if (td) td.remove();
      });
    });

    await table.revalidate();
    expect(await table.getHeaders()).toEqual(['A']);
  });

  test('toArray() scrapes rows then resets page index (#432)', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>Name</th></tr></thead>
        <tbody>
          <tr><td>Alice</td></tr>
          <tr><td>Bob</td></tr>
        </tbody>
      </table>
    `);
    const table = useTable(page.locator('#t'));
    await table.init();
    table.currentPageIndex = 2;

    const rows = await table.toArray();
    expect(rows).toEqual([{ Name: 'Alice' }, { Name: 'Bob' }]);
    expect(table.currentPageIndex).toBe(0);
  });

  test('function selectors resolve headers and cells (#432)', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Alice</td></tr>
          <tr><td>2</td><td>Bob</td></tr>
        </tbody>
      </table>
    `);
    const table = useTable(page.locator('#t'), {
      headerSelector: (root) => root.locator('thead th'),
      rowSelector: 'tbody tr',
      cellSelector: (row) => row.locator('td'),
    });
    await table.init();
    expect(await table.getHeaders()).toEqual(['ID', 'Name']);
    const row = table.getRow({ Name: 'Bob' });
    await expect(row.getCell('ID')).toHaveText('2');
  });

  test('function rowSelector drives find, count, and iteration (#457)', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody>
          <tr class="group"><td colspan="2">Group A</td></tr>
          <tr><td>1</td><td>Alice</td></tr>
          <tr><td>2</td><td>Bob</td></tr>
        </tbody>
      </table>
    `);
    const table = useTable(page.locator('#t'), {
      rowSelector: (root) => root.locator('tbody tr').filter({ hasNot: root.page().locator('td[colspan]') }),
    });
    await table.init();
    expect(await table.countRows()).toBe(2);
    const bob = await table.findRow({ Name: 'Bob' });
    await expect(bob.getCell('ID')).toHaveText('2');
    expect(await table.map(({ row }) => row.getValue('Name'))).toEqual(['Alice', 'Bob']);
  });

  test('headerSelector can reach headers rendered as a separate table (#457)', async ({ page }) => {
    await page.setContent(`
      <table id="head"><thead><tr><th>ID</th><th>Name</th></tr></thead></table>
      <table id="body">
        <tbody>
          <tr><td>1</td><td>Alice</td></tr>
          <tr><td>2</td><td>Bob</td></tr>
        </tbody>
      </table>
    `);
    const table = useTable(page.locator('#body'), {
      headerSelector: (root) => root.page().locator('#head th'),
    });
    await table.init();
    expect(await table.getHeaders()).toEqual(['ID', 'Name']);
    await expect(table.getRow({ Name: 'Alice' }).getCell('ID')).toHaveText('1');
  });

  test('getRow multi-match is a multi-element locator (#432)', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Active</td></tr>
          <tr><td>Active</td></tr>
        </tbody>
      </table>
    `);
    const table = useTable(page.locator('#t'));
    await table.init();
    const row = table.getRow({ Status: 'Active' });
    await expect(row).toHaveCount(2);
    // Actions that require a single element surface Playwright's strict mode error
    await expect(row.click()).rejects.toThrow(/strict mode violation/i);
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

  test('onReset runs after goToFirst and autoInit (#404)', async ({ page }) => {
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

    let pageTextDuringOnReset = '';
    const table = useTable(page.locator('#t'), {
      strategies: { pagination: Strategies.Pagination.click({ next: '#next', first: '#first' }) },
      maxPages: 2,
      onReset: async () => {
        pageTextDuringOnReset = await page.locator('#page').textContent() ?? '';
      },
    });
    await table.init();
    await table.findRows({});
    expect(table.currentPageIndex).toBe(1);
    await expect(page.locator('#page')).toHaveText('2');

    await table.reset();
    expect(pageTextDuringOnReset).toBe('1');
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

  test('scrollToColumn prefers viewport.scrollToColumn when configured (#430)', async ({ page }) => {
    await page.setContent(`
      <table id="t">
        <thead><tr><th>Col1</th><th>Col2</th><th>Col3</th></tr></thead>
        <tbody><tr><td>A</td><td>B</td><td>C</td></tr></tbody>
      </table>
    `);
    const scrolled: number[] = [];
    const table = useTable(page.locator('#t'), {
      strategies: {
        viewport: {
          scrollToColumn: async (_ctx, colIndex) => {
            scrolled.push(colIndex);
          },
        },
      },
    });
    await table.init();
    await table.scrollToColumn('Col3');
    expect(scrolled).toEqual([2]);
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
    // exact: false matches both "John" and "John Doe" — count confirms ambiguity
    const partialRow = table.getRow({ Name: 'John' }, { exact: false });
    await expect(partialRow).toHaveCount(2);
  });

  test('findRow with maxPages: 1 returns a sentinel (wasFound false) when the row is on a later page', async ({ page }) => {
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

    // getRow only sees the current page; findRow paginates.
    await expect(table.getRow({ Name: 'Carol' })).not.toBeVisible();
    expect(table.getRow({ Name: 'Alice' }).wasFound()).toBe(true);

    const missing = await table.findRow({ Name: 'Carol' }, { maxPages: 1 });
    expect(missing.wasFound()).toBe(false);
    await expect(missing).not.toBeVisible();

    const found = await table.findRow({ Name: 'Carol' }, { maxPages: 2 });
    expect(found.wasFound()).toBe(true);
    await expect(found).toBeVisible();
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
