import { test, expect, type Page } from '@playwright/test';
import { useTable, Strategies, type TableResult } from '../src';

async function makeTable(page: Page) {
    await page.setContent(`<table id="t" data-column="0">
      <thead><tr><th>Name</th><th>Age</th></tr></thead>
      <tbody>
        <tr data-index="0" data-visible="1"><td>Alice</td><td>35</td></tr>
        <tr data-index="1" data-visible="0"><td>Bob</td><td>42</td></tr>
      </tbody></table>`);
    const showBob = async () => {
        await page.locator('tbody tr').nth(1).evaluate(el => el.setAttribute('data-visible', '1'));
    };
    let sortState: 'none' | 'asc' | 'desc' = 'none';
    const table = await useTable(page.locator('#t'), {
        autoScroll: false,
        strategies: {
            loading: { isHeaderLoading: Strategies.Loading.Headers.never, isTableLoading: async () => false },
            resolveRowIndex: async row => Number(await row.getAttribute('data-index')),
            viewport: {
                getVisibleRowIndices: async ({ root }) => root.locator('tbody tr').evaluateAll(rows =>
                    rows.flatMap((row, i) => row.getAttribute('data-visible') === '1' ? [i] : [])),
                getVisibleRowRange: async ({ root }) => root.evaluate(el => {
                    const forced = el.getAttribute('data-row');
                    if (forced !== null) return { first: Number(forced), last: Number(forced) };
                    const indices = [...el.querySelectorAll('tbody tr')]
                        .filter(row => row.getAttribute('data-visible') === '1')
                        .map(row => Number(row.getAttribute('data-index')));
                    return { first: Math.min(...indices), last: Math.max(...indices) };
                }),
                getVisibleColumnRange: async ({ root }) => {
                    const index = Number(await root.getAttribute('data-column'));
                    return { first: index, last: index };
                },
                scrollToColumn: async () => { throw new Error('Unnecessary scroll would move the viewport'); },
            },
            sorting: {
                getSortState: async () => sortState,
                doSort: async ({ direction }) => { sortState = direction; await showBob(); },
            },
        },
    }).init();
    return { table, showBob };
}

const names = (table: TableResult) => table.map(({ row }) => row.getValue('Name'));

for (const action of ['external update', 'reset', 'revalidate', 'sort'] as const) {
    test(`a scan sees current membership after ${action}`, async ({ page }) => {
        const { table, showBob } = await makeTable(page);
        expect(await names(table)).toEqual(['Alice']);
        if (action === 'sort') await table.sorting.apply('Name', 'asc');
        else {
            await showBob();
            if (action === 'reset') await table.reset();
            if (action === 'revalidate') await table.revalidate();
        }
        expect(await names(table)).toEqual(['Alice', 'Bob']);
    });
}

for (const method of ['forEach', 'iterator'] as const) {
    test(`${method} sees external changes after an earlier map`, async ({ page }) => {
        const { table, showBob } = await makeTable(page);
        expect(await names(table)).toEqual(['Alice']);
        await showBob();
        const result: string[] = [];
        if (method === 'forEach') await table.forEach(async ({ row }) => { result.push(await row.getValue('Name')); });
        else for await (const { row } of table) result.push(await row.getValue('Name'));
        expect(result).toEqual(['Alice', 'Bob']);
    });
}

test('a standalone cell read sees externally changed column visibility', async ({ page }) => {
    const { table } = await makeTable(page);
    const row = table.getRowByIndex(0);
    expect(await row.getValue('Name')).toBe('Alice');
    await page.locator('#t').evaluate(el => el.setAttribute('data-column', '1'));
    expect(await row.getValue('Age')).toBe('35');
});

test('a standalone cell read sees externally changed row visibility', async ({ page }) => {
    const { table } = await makeTable(page);
    expect(await table.getRowByIndex(0).getValue('Name')).toBe('Alice');
    await page.locator('#t').evaluate(el => el.setAttribute('data-row', '1'));
    expect(await table.getRowByIndex(1).getValue('Name')).toBe('Bob');
});

test('synchronized peers refresh geometry after another row performs the shared scroll', async ({ page }) => {
    await makeTable(page);
    await page.locator('tbody tr').evaluateAll(rows => rows.forEach(row => {
        row.children[0].setAttribute('data-col', '0');
        row.children[1].remove();
    }));
    let column = 0;
    const table = await useTable(page.locator('#t'), {
        autoScroll: false,
        concurrency: 'synchronized',
        strategies: {
            loading: { isHeaderLoading: Strategies.Loading.Headers.never },
            resolveRowIndex: async row => Number(await row.getAttribute('data-index')),
            getCellLocator: ({ row, columnIndex }) => row.locator(`[data-col="${columnIndex}"]`),
            viewport: {
                getVisibleColumnRange: async () => ({ first: column, last: column }),
                scrollToColumn: async (_context, index) => {
                    column = index;
                    // Only Alice's off-screen cell mounts; Bob's failure must describe the new viewport.
                    await page.locator('tbody tr').first().evaluate(el => el.insertAdjacentHTML('beforeend', '<td data-col="1">35</td>'));
                },
            },
        },
    }).init();
    await expect(table.map(({ row }) => row.toJSON())).rejects.toThrow('Visible column range: [1–1]');
});
