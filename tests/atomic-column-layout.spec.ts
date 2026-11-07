import { test, expect } from '@playwright/test';
import { useTable } from '../src';

const partial = `<table id="t"><thead><tr>${['A', 'B', 'C', 'D', 'E', 'F'].map(c => `<th>${c}</th>`).join('')}</tr></thead>
<tbody><tr><td data-col="D">d1</td><td data-col="E">e1</td><td data-col="F">f1</td></tr></tbody></table>`;

for (const custom of [false, true]) {
    for (const columns of [undefined, ['D', 'E', 'F'], ['A']]) {
        test(`rejects partial columns: custom=${custom}, columns=${columns?.join(',') ?? 'all'}`, async ({ page }) => {
            await page.setContent(partial);
            let reads = 0;
            const table = await useTable(page.locator('#t'), {
                strategies: custom ? {
                    getCellLocator: ({ row, columnName }) => row.locator(`[data-col="${columnName}"]`),
                } : {},
                columnOverrides: { A: { read: async cell => { reads++; return cell.innerText(); } } },
            }).init();
            const row = table.getRowByIndex(0);
            if (custom) {
                expect(await row.toJSON({ columns: ['D', 'E', 'F'] })).toEqual({ D: 'd1', E: 'e1', F: 'f1' });
                reads = 0;
            }
            await expect(row.toJSON({ atomic: true, columns })).rejects.toThrow(
                custom ? /atomic.*getCellLocator/ : /atomic.*3 cells.*6 mapped columns/,
            );
            expect(reads).toBe(0); // Fail before running any override against a misidentified cell.
            expect(await page.locator('[id^="__st_snap_"]').count()).toBe(0);
        });
    }
}

test('rejects a leading filler cell even when requested columns fit the cell count', async ({ page }) => {
    await page.setContent('<table id="t"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>filler</td><td>a1</td><td>b1</td></tr></tbody></table>');
    const table = await useTable(page.locator('#t')).init();
    await expect(table.getRowByIndex(0).toJSON({ atomic: true, columns: ['A'] }))
        .rejects.toThrow(/atomic.*3 cells.*2 mapped columns/);
});

test('rejects a custom strategy even when all cells are mounted but ordered differently', async ({ page }) => {
    await page.setContent('<table id="t"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td data-col="B">b1</td><td data-col="A">a1</td></tr></tbody></table>');
    const table = await useTable(page.locator('#t'), {
        strategies: { getCellLocator: ({ row, columnName }) => row.locator(`[data-col="${columnName}"]`) },
    }).init();
    const row = table.getRowByIndex(0);
    expect(await row.toJSON()).toEqual({ A: 'a1', B: 'b1' });
    await expect(row.toJSON({ atomic: true })).rejects.toThrow(/atomic.*getCellLocator/);
});

test('positional atomic reads preserve frozen sibling reads and synthetic columns', async ({ page }) => {
    await page.setContent('<table id="t"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>a1</td><td>b1</td></tr></tbody></table>');
    const table = await useTable(page.locator('#t'), {
        columnOverrides: { A: { read: async (cell, { getCell }) => {
            await page.locator('tbody td').nth(1).evaluate(el => { el.textContent = 'changed'; });
            return `${await cell.innerText()}/${await getCell('B').innerText()}`;
        } } },
        syntheticColumns: { combined: { compute: async row => `${await row.getValue('A')}:${await row.getValue('B')}` } },
    }).init();
    expect(await table.getRowByIndex(0).toJSON({ atomic: true })).toEqual({ A: 'a1/b1', B: 'b1', combined: 'a1/b1:b1' });
});
