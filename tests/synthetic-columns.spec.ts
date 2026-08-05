import { test, expect, type Page } from '@playwright/test';
import { useTable } from '../src/index';

const TABLE = `
    <table id="t">
        <thead><tr><th>Name</th><th>Price</th><th>Qty</th></tr></thead>
        <tbody>
            <tr><td>Widget</td><td>10</td><td>5</td></tr>
            <tr><td>Gadget</td><td>25</td><td>4</td></tr>
            <tr><td>Doohickey</td><td>7</td><td>10</td></tr>
        </tbody>
    </table>
`;

test.describe('Synthetic Columns (#391)', () => {
    const makeTable = (page: Page) =>
        useTable(page.locator('#t'), {
            syntheticColumns: {
                Total: {
                    compute: async (row) => {
                        const price = Number(await row.getValue('Price'));
                        const qty = Number(await row.getValue('Qty'));
                        return String(price * qty);
                    },
                },
                Label: {
                    compute: async (row) => {
                        const name = await row.getValue('Name');
                        return `Item: ${name}`;
                    },
                },
            },
        });

    test('toJSON includes synthetic columns', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();
        const row = await table.findRow({ Name: 'Widget' });
        const data = await row.toJSON() as Record<string, string>;

        expect(data.Total).toBe('50');
        expect(data.Label).toBe('Item: Widget');
        expect(data.Name).toBe('Widget');
        expect(data.Price).toBe('10');
        expect(data.Qty).toBe('5');
    });

    test('toJSON with columns option filters synthetics', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();
        const row = await table.findRow({ Name: 'Gadget' });
        const data = await row.toJSON({ columns: ['Name', 'Total'] }) as Record<string, string>;

        expect(data.Name).toBe('Gadget');
        expect(data.Total).toBe('100');
        expect(data.Price).toBeUndefined();
        expect(data.Label).toBeUndefined();
    });

    test('getValue works for real and synthetic columns', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();
        const row = await table.findRow({ Name: 'Doohickey' });

        expect(await row.getValue('Name')).toBe('Doohickey');
        expect(await row.getValue('Price')).toBe('7');
        expect(await row.getValue('Total')).toBe('70');
    });

    test('getCell throws for synthetic columns', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();
        const row = await table.findRow({ Name: 'Widget' });

        expect(() => row.getCell('Total')).toThrow(/synthetic.*no DOM cell/);
    });

    test('smartFill throws for synthetic columns', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();
        const row = await table.findRow({ Name: 'Widget' });

        await expect(row.smartFill({ Total: '999' } as any)).rejects.toThrow(/synthetic/);
    });

    test('findRow filters by synthetic column value', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();
        const row = await table.findRow({ Total: '100' }, { exact: true });
        const data = await row.toJSON() as Record<string, string>;

        expect(data.Name).toBe('Gadget');
    });

    test('findRow combines DOM + synthetic filters', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();
        const row = await table.findRow({ Name: 'Widget', Total: '50' }, { exact: true });
        const data = await row.toJSON() as Record<string, string>;

        expect(data.Name).toBe('Widget');
        expect(data.Total).toBe('50');
    });

    test('findRows filters by synthetic column', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();
        const rows = await table.findRows({ Total: '70' }, { exact: true });

        expect(rows.length).toBe(1);
        const data = await rows[0].toJSON() as Record<string, string>;
        expect(data.Name).toBe('Doohickey');
    });

    test('countRows with synthetic filter', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();

        expect(await table.countRows({ Total: '50' }, { exact: true })).toBe(1);
        expect(await table.countRows({ Total: '999' }, { exact: true })).toBe(0);
    });

    test('getRow throws when filtering by synthetic column', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();

        expect(() => table.getRow({ Total: '50' } as any)).toThrow(/synthetic.*findRow/);
    });

    test('getHeaders includes synthetic column names', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();
        const headers = await table.getHeaders();

        expect(headers).toEqual(['Name', 'Price', 'Qty', 'Total', 'Label']);
    });

    test('collision between synthetic and real header throws at init', async ({ page }) => {
        await page.setContent(TABLE);
        const table = useTable(page.locator('#t'), {
            syntheticColumns: {
                Price: { compute: async () => '0' },
            },
        });

        await expect(table.init()).rejects.toThrow(/collide.*Price/);
    });

    test('synthetic column cannot read another synthetic (no chaining)', async ({ page }) => {
        await page.setContent(TABLE);
        const table = useTable(page.locator('#t'), {
            syntheticColumns: {
                A: { compute: async (row) => row.getValue('Name') },
                B: { compute: async (row) => row.getValue('A') },
            },
        });
        await table.init();
        const row = await table.findRow({ Name: 'Widget' });

        await expect(row.getValue('B')).rejects.toThrow(/cannot be read.*inside another synthetic/);
    });
});
