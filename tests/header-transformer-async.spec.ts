import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

test('an async headerTransformer can read each header through its locator', async ({ page }) => {
    await page.setContent(`
        <table id="t">
            <thead><tr>
                <th data-field="name"><span>Full name</span><span class="icon">▲</span></th>
                <th data-field="email"><span>E-mail</span></th>
                <th><span>Notes</span></th>
            </tr></thead>
            <tbody><tr><td>Alice</td><td>alice@x.io</td><td>VIP</td></tr></tbody>
        </table>
    `);
    const seen: { index: number; text: string }[] = [];

    const table = useTable(page.locator('#t'), {
        headerTransformer: async ({ text, index, locator }) => {
            seen.push({ index, text });
            return (await locator.getAttribute('data-field')) ?? text.toLowerCase();
        },
    });

    expect(await table.getHeaders()).toEqual(['name', 'email', 'notes']);
    expect(seen.map(s => s.index)).toEqual([0, 1, 2]);
    await expect(table.getRow({ name: 'Alice' }).getCell('email')).toHaveText('alice@x.io');
});
