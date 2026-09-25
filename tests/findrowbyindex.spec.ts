import { test, expect } from '@playwright/test';
import { useTable } from '../src';

/**
 * findRowByIndex (#354) — async accessor for a row's logical/data-model index, as opposed to
 * the sync getRowByIndex (render-window position). These deterministic cases cover the mounted
 * path and the two throw contracts; real-virtualization scroll/pagination is covered against
 * the MUI DataGrid in tests/integration/mui-data-grid.spec.ts.
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
