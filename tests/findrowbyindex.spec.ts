import { test, expect } from '@playwright/test';
import { useTable } from '../src';

/**
 * findRowByIndex (#354) — async accessor for a row's logical/data-model index, as opposed to
 * the sync getRowByIndex (render-window position). These deterministic cases cover the mounted
 * path, the viewport.scrollToRow jump and the two throw contracts; the MUI DataGrid version is
 * in tests/integration/mui-data-grid.spec.ts.
 */
const HTML = `
  <table id="t">
    <thead><tr><th>Name</th></tr></thead>
    <tbody>
      <tr data-ri="100"><td>Alice</td></tr>
      <tr data-ri="101"><td>Bob</td></tr>
      <tr data-ri="102"><td>Carol</td></tr>
    </tbody>
  </table>
`;

const resolveRowIndex = async (row: import('@playwright/test').Locator) => {
    const v = await row.getAttribute('data-ri');
    return v != null ? Number(v) : undefined;
};

test.describe('findRowByIndex (#354)', () => {
    test('returns the row with the given logical index (already mounted)', async ({ page }) => {
        await page.setContent(HTML);
        const table = await useTable(page.locator('#t'), { strategies: { resolveRowIndex } }).init();

        const row = await table.findRowByIndex(101);
        expect(row.rowIndex).toBe(101);
        expect(await row.getCell('Name').innerText()).toBe('Bob');
    });

    test('throws without a resolveRowIndex strategy', async ({ page }) => {
        await page.setContent(HTML);
        const table = await useTable(page.locator('#t')).init();

        await expect(table.findRowByIndex(101)).rejects.toThrow(/requires a strategies\.resolveRowIndex/);
    });

    test('jumps to an unmounted row with viewport.scrollToRow (virtualized list)', async ({ page }) => {
        await page.setContent(`
            <div id="grid" style="height: 300px; overflow-y: auto">
                <table style="border-spacing: 0">
                    <thead><tr><th>Name</th></tr></thead>
                    <tbody id="body"></tbody>
                </table>
            </div>
            <script>
                const ROW_H = 30, TOTAL = 1000, VISIBLE = 10;
                const grid = document.getElementById('grid');
                function render() {
                    const first = Math.min(TOTAL - VISIBLE, Math.floor(grid.scrollTop / ROW_H));
                    let html = '<tr style="height:' + first * ROW_H + 'px"></tr>';
                    for (let i = first; i < first + VISIBLE; i++) {
                        html += '<tr data-ri="' + i + '" style="height:' + ROW_H + 'px"><td>User ' + i + '</td></tr>';
                    }
                    html += '<tr style="height:' + (TOTAL - first - VISIBLE) * ROW_H + 'px"></tr>';
                    document.getElementById('body').innerHTML = html;
                }
                grid.addEventListener('scroll', render);
                render();
            </script>
        `);
        const scrolledTo: number[] = [];
        const table = await useTable(page.locator('#grid'), {
            rowSelector: 'tbody tr[data-ri]',
            strategies: {
                resolveRowIndex,
                viewport: {
                    scrollToRow: async ({ root }, index) => {
                        scrolledTo.push(index);
                        await root.evaluate((el, i) => { el.scrollTop = i * 30; }, index);
                        await root.locator(`tr[data-ri="${index}"]`).waitFor({ state: 'attached' });
                    },
                },
            },
        }).init();
        await expect(page.locator('tr[data-ri="500"]')).toHaveCount(0);

        const row = await table.findRowByIndex(500);

        expect(scrolledTo).toEqual([500]);
        expect(row.rowIndex).toBe(500);
        await expect(row.getCell('Name')).toHaveText('User 500');
    });

    test('throws when the index cannot be reached (no scroll or pagination)', async ({ page }) => {
        await page.setContent(HTML);
        const table = await useTable(page.locator('#t'), { strategies: { resolveRowIndex } }).init();

        await expect(table.findRowByIndex(9999)).rejects.toThrow(/could not reach row 9999/);
    });
});

test.describe('getRowByIndex in a scrolled render window', () => {
    const WINDOW = `
      <div id="scroll" style="height: 30px; overflow-y: auto">
        <table id="t" style="border-spacing: 0">
          <thead><tr><th style="height: 30px">Name</th></tr></thead>
          <tbody>
            <tr data-ri="100"><td style="height: 30px">Alice</td></tr>
            <tr data-ri="101"><td style="height: 30px">Bob</td></tr>
            <tr data-ri="102"><td style="height: 30px">Carol</td></tr>
          </tbody>
        </table>
      </div>
    `;

    test('resolves the logical index before viewport scrolling', async ({ page }) => {
        await page.setContent(WINDOW);
        const scrolledTo: number[] = [];
        const table = await useTable(page.locator('#t'), {
            strategies: {
                resolveRowIndex,
                viewport: {
                    scrollToRow: async ({ page }, index) => {
                        scrolledTo.push(index);
                        await page.locator(`tr[data-ri="${index}"]`).scrollIntoViewIfNeeded();
                    },
                },
            },
        }).init();
        await page.locator('#scroll').evaluate(el => { el.scrollTop = 30; });
        const row = table.getRowByIndex(2); // render position 2 is logical row 102
        await expect(row).not.toBeInViewport();

        await row.bringIntoView();

        expect(scrolledTo).toEqual([102]);
        await expect(row).toBeInViewport();
        await expect(row.getCell('Name')).toHaveText('Carol');
    });

    test('uses locator scrolling when no logical index resolver is configured', async ({ page }) => {
        await page.setContent(WINDOW);
        const scrolledTo: number[] = [];
        const table = await useTable(page.locator('#t'), {
            strategies: { viewport: { scrollToRow: async (_ctx, index) => { scrolledTo.push(index); } } },
        }).init();
        await page.locator('#scroll').evaluate(el => { el.scrollTop = 30; });
        const row = table.getRowByIndex(2);
        await expect(row).not.toBeInViewport();

        await row.bringIntoView();

        expect(scrolledTo).toEqual([]);
        await expect(row).toBeInViewport();
        await expect(row.getCell('Name')).toHaveText('Carol');
    });
});
