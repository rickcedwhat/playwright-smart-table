import { test, expect } from '@playwright/test';
import { useTable } from '../src';

/**
 * Characterization tests for row-index resolution (#362 PR-2 consolidation).
 * These pin the CURRENT observable behavior of findRow/findRows so the refactor
 * that extracts a shared resolveLogicalRowIndex helper is provably behavior-neutral.
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

test.describe('rowIndex resolution — characterization (#362)', () => {
    test('findRow uses the resolveRowIndex strategy for a logical index', async ({ page }) => {
        await page.setContent(HTML);
        const table = await useTable(page.locator('#t'), { strategies: { resolveRowIndex } }).init();
        const carol = await table.findRow({ Name: 'Carol' });
        expect(carol.rowIndex).toBe(102); // strategy value, not DOM position (2)
    });

    test('findRow falls back to DOM position without a strategy', async ({ page }) => {
        await page.setContent(HTML);
        const table = await useTable(page.locator('#t')).init();
        const carol = await table.findRow({ Name: 'Carol' });
        expect(carol.rowIndex).toBe(2);
    });

    test('findRows uses the resolveRowIndex strategy per row', async ({ page }) => {
        await page.setContent(HTML);
        const table = await useTable(page.locator('#t'), { strategies: { resolveRowIndex } }).init();
        const rows = await table.findRows({});
        expect(rows.map(r => r.rowIndex)).toEqual([100, 101, 102]);
    });

    test('findRows falls back to a running counter without a strategy', async ({ page }) => {
        await page.setContent(HTML);
        const table = await useTable(page.locator('#t')).init();
        const rows = await table.findRows({});
        expect(rows.map(r => r.rowIndex)).toEqual([0, 1, 2]);
    });

    test('resolveRowIndex returning undefined falls through to the fallback', async ({ page }) => {
        await page.setContent(HTML);
        // Strategy that only resolves for Bob; others fall through to the fallback.
        const partial = async (row: import('@playwright/test').Locator) => {
            const name = (await row.innerText()).trim();
            return name.includes('Bob') ? 999 : undefined;
        };
        const table = await useTable(page.locator('#t'), { strategies: { resolveRowIndex: partial } }).init();
        const rows = await table.findRows({});
        // Bob → 999 (strategy); Alice/Carol → running counter (their allRows.length at push time).
        expect(rows.map(r => r.rowIndex)).toEqual([0, 999, 2]);
    });
});
