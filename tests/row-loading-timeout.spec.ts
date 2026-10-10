import { test, expect, Page } from '@playwright/test';
import { useTable, Strategies } from '../src/index';
import type { LoadingStrategy } from '../src/types';

// Bob's row stays a skeleton unless `bobLoadsAfterMs` is set.
async function setupTable(page: Page, bobLoadsAfterMs?: number) {
    await page.setContent(`
        <table id="t">
            <thead><tr><th>Name</th></tr></thead>
            <tbody>
                <tr><td>Alice</td></tr>
                <tr id="bob" class="skeleton"><td></td></tr>
                <tr><td>Carol</td></tr>
            </tbody>
        </table>
        <script>
            ${bobLoadsAfterMs === undefined ? '' : `setTimeout(() => {
                const bob = document.getElementById('bob');
                bob.classList.remove('skeleton');
                bob.querySelector('td').textContent = 'Bob';
            }, ${bobLoadsAfterMs});`}
        </script>
    `);
}

const tableWith = (page: Page, loading: Partial<LoadingStrategy>) =>
    useTable(page.locator('#t'), {
        strategies: {
            loading: { isRowLoading: Strategies.Loading.Row.hasClass('skeleton'), rowLoadingTimeout: 200, ...loading },
        },
    });

const names = (rows: { getCell(c: string): { innerText(): Promise<string> } }[]) =>
    Promise.all(rows.map(r => r.getCell('Name').innerText()));

test.describe('row loading timeouts (deterministic)', () => {
    test('a row that loads within rowLoadingTimeout is read after it loads', async ({ page }) => {
        await setupTable(page, 50);
        const table = tableWith(page, { rowLoadingTimeout: 2000, onRowLoadingTimeout: 'throw' });

        expect(await names(await table.findRows({}))).toEqual(['Alice', 'Bob', 'Carol']);
    });

    test('findRows with onRowLoadingTimeout "skip" leaves out the stuck row', async ({ page }) => {
        await setupTable(page);
        const table = tableWith(page, { onRowLoadingTimeout: 'skip' });

        expect(await names(await table.findRows({}))).toEqual(['Alice', 'Carol']);
    });

    test('findRows with onRowLoadingTimeout "throw" rejects', async ({ page }) => {
        await setupTable(page);
        const table = tableWith(page, { onRowLoadingTimeout: 'throw' });

        await expect(table.findRows({})).rejects.toThrow('did not finish loading within 200ms');
    });

    test('findRows reads the stuck row as-is by default once a timeout is set', async ({ page }) => {
        await setupTable(page);
        const table = tableWith(page, {});

        expect(await names(await table.findRows({}))).toEqual(['Alice', '', 'Carol']);
    });

    test('map with onRowLoadingTimeout "throw" rejects', async ({ page }) => {
        await setupTable(page);
        const table = tableWith(page, { onRowLoadingTimeout: 'throw' });

        await expect(table.map(({ row }) => row.getCell('Name').innerText()))
            .rejects.toThrow('did not finish loading within 200ms');
    });

    test('map with onRowLoadingTimeout "skip" leaves out the stuck row', async ({ page }) => {
        await setupTable(page);
        const table = tableWith(page, { onRowLoadingTimeout: 'skip' });

        expect(await table.map(({ row }) => row.getCell('Name').innerText())).toEqual(['Alice', 'Carol']);
    });
});
