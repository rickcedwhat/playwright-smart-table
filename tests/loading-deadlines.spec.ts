import { test, expect } from '@playwright/test';
import { useTable } from '../src';

const HTML = '<table id="t"><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Alice</td></tr></tbody></table>';
const pending = () => new Promise<boolean>(() => {});

test.beforeEach(async ({ page }) => { await page.setContent(HTML); });

for (const method of ['findRows', 'map'] as const) {
    for (const policy of ['skip', 'throw', 'read-as-is'] as const) {
        test(`${method} applies row ${policy} when the loading check never finishes`, async ({ page }) => {
            const table = await useTable(page.locator('#t'), {
                autoScroll: false,
                strategies: { loading: { isRowLoading: pending, rowLoadingTimeout: 50, onRowLoadingTimeout: policy } },
            }).init();
            const reading = method === 'findRows'
                ? table.findRows().then(rows => rows.toJSON())
                : table.map(({ row }) => row.toJSON());
            if (policy === 'throw') await expect(reading).rejects.toThrow('did not finish loading within 50ms');
            else expect(await reading).toEqual(policy === 'skip' ? [] : [{ Name: 'Alice' }]);
        });
    }
}

for (const policy of ['skip', 'throw', 'read-as-is', 'callback'] as const) {
    test(`toJSON applies cell ${policy} when the loading check never finishes`, async ({ page }) => {
        const table = await useTable(page.locator('#t'), {
            autoScroll: false,
            strategies: { loading: { isCellLoading: pending, cellLoadingTimeout: 50,
                onCellLoadingTimeout: policy === 'callback' ? async () => 'fallback' : policy } },
        }).init();
        const reading = table.getRowByIndex(0).toJSON();
        if (policy === 'throw') await expect(reading).rejects.toThrow('did not finish loading within 50ms');
        else expect(await reading).toEqual({ Name: policy === 'skip' ? '' : policy === 'callback' ? 'fallback' : 'Alice' });
    });
}

test('init rejects when its header-loading check never finishes', async ({ page }) => {
    let calls = 0;
    const table = useTable(page.locator('#t'), {
        autoScroll: false,
        strategies: { loading: { isHeaderLoading: () => { calls++; return pending(); } } },
    });
    await expect(table.init({ timeout: 500 })).rejects.toThrow('Timed out waiting for headers after 500ms');
    expect(calls).toBe(1);
});
