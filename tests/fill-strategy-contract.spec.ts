import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';
import type { FillStrategy } from '../src/types';

const HTML = `
    <table id="t">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>
            <tr><td>Alice</td><td><input class="email" value="a@x.io"></td><td><input class="role" value="user"></td></tr>
        </tbody>
    </table>
`;

test.describe('custom strategies.fill contract', () => {
    test('is called once per filled column, in order, with the documented arguments', async ({ page }) => {
        await page.setContent(HTML);
        const calls: Parameters<FillStrategy>[0][] = [];

        const table = useTable(page.locator('#t'), {
            strategies: {
                fill: async (args) => {
                    calls.push(args);
                    await args.row.getCell(args.columnName).locator('input').fill(String(args.value));
                },
            },
        });
        await table.init();

        const row = await table.findRow({ Name: 'Alice' });
        const fillOptions = { inputMappers: { Email: (cell: import('@playwright/test').Locator) => cell.locator('input') } };
        await row.smartFill({ Email: 'alice@x.io', Role: 'admin', Name: undefined }, fillOptions);

        expect(calls.map(c => [c.columnName, c.value])).toEqual([['Email', 'alice@x.io'], ['Role', 'admin']]);
        for (const call of calls) {
            expect(call.row).toBe(row);
            expect(call.index).toBe(0);
            expect(call.fillOptions).toBe(fillOptions);
            expect(call.table).toBe(table);
            expect(call.config.rowSelector).toBe('tbody tr');
            expect(call.page).toBe(page);
            expect(await call.rootLocator.getAttribute('id')).toBe('t');
        }
        await expect(page.locator('.email')).toHaveValue('alice@x.io');
        await expect(page.locator('.role')).toHaveValue('admin');
    });

    test('receives index -1 for a getRow() row (rowIndex unknown)', async ({ page }) => {
        await page.setContent(HTML);
        const indices: number[] = [];

        const table = useTable(page.locator('#t'), {
            strategies: { fill: async ({ index }) => { indices.push(index); } },
        });
        await table.init();

        await table.getRow({ Name: 'Alice' }).smartFill({ Role: 'admin' });

        expect(indices).toEqual([-1]);
    });

    test('a throwing fill strategy is rethrown with the column name', async ({ page }) => {
        await page.setContent(HTML);
        const table = useTable(page.locator('#t'), {
            strategies: { fill: async () => { throw new Error('input is read-only'); } },
        });

        const row = await table.findRow({ Name: 'Alice' });

        await expect(row.smartFill({ Role: 'admin' })).rejects.toThrow(
            '[SmartTable] smartFill: fill strategy for "Role" failed — input is read-only',
        );
    });
});
