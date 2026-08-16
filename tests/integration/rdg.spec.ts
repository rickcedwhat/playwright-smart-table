import { test, expect } from '@playwright/test';
import { useTable, presets } from '../../src/index';

const RDG_URL = 'http://localhost:3060';

test.describe('React Data Grid (RDG)', () => {
    test.setTimeout(60000);

    test('should collect all headers from virtualized columns', async ({ page }) => {
        await page.goto(RDG_URL, { waitUntil: 'domcontentloaded' });

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, {
            ...presets.rdg
        });

        await table.init();
        const headers = await table.getHeaders();

        console.log('Headers found:', headers);
        console.log('Total headers:', headers.length);

        expect(headers.length).toBeGreaterThanOrEqual(15);
        expect(headers).toContain('ID');
        expect(headers).toContain('Task');
    });

    test('should read data from all columns including virtualized ones', async ({ page }) => {
        await page.goto(RDG_URL, { waitUntil: 'domcontentloaded' });

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, {
            ...presets.rdg
        });

        await table.init();

        const rows = await table.findRows({}, { maxPages: 1 });
        const firstRow = rows[0];

        const rowData = await firstRow.toJSON();
        console.log('First row data:', rowData);
        console.log('Columns in row:', Object.keys(rowData).length);

        expect(Object.keys(rowData).length).toBeGreaterThanOrEqual(15);
        expect(rowData).toHaveProperty('ID');
        expect(rowData).toHaveProperty('Task');
    });

    test('should paginate through virtualized rows', async ({ page }) => {
        await page.goto(RDG_URL, { waitUntil: 'domcontentloaded' });

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, {
            ...presets.rdg,
            strategies: {
                ...presets.rdg.strategies,
                dedupe: async (row) => row.getCell('ID').innerText()
            },
            maxPages: 3
        });

        await table.init();

        const flatData = await table.map(
            ({ row }) => row.toJSON({ columns: ['ID', 'Task', 'Client'] }),
            { maxPages: 3 }
        );
        console.log(`Total rows collected: ${flatData.length}`);

        // Filter out the sticky summary row ("Total")
        const dataRows = flatData.filter((r: any) => r.ID !== 'Total');
        console.log(`Data rows: ${dataRows.length}`);

        expect(dataRows.length).toBeGreaterThan(20);

        const uniqueIds = new Set(dataRows.map((r: any) => r.ID));
        console.log(`Unique IDs: ${uniqueIds.size}`);
        expect(uniqueIds.size).toBe(dataRows.length);
    });

    test('synchronized map collects 50+ unique rows without stale-locator errors (issue #120)', async ({ page }) => {
        await page.goto(RDG_URL, { waitUntil: 'domcontentloaded' });

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, {
            ...presets.rdg,
            strategies: {
                ...presets.rdg.strategies,
                dedupe: async (row) => row.getCell('ID').innerText(),
            },
        });

        await table.init();

        const rows = await table.map(
            ({ row }) => row.toJSON({ columns: ['ID', 'Task'] }),
            { concurrency: 'synchronized', maxPages: 4 },
        );

        const dataRows = rows.filter((r: any) => r.ID !== 'Total');

        expect(dataRows.length).toBeGreaterThanOrEqual(50);

        expect(dataRows.every((r: any) => /^\d+$/.test(String(r.ID)))).toBe(true);

        const uniqueIds = new Set(dataRows.map((r: any) => r.ID));
        expect(uniqueIds.size).toBe(dataRows.length);
    });

    test('should handle reading specific columns from middle of table', async ({ page }) => {
        await page.goto(RDG_URL, { waitUntil: 'domcontentloaded' });

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, {
            ...presets.rdg
        });

        await table.init();
        const headers = await table.getHeaders();
        console.log('All headers:', headers);

        const rows = await table.findRows({}, { maxPages: 1 });
        const firstRow = rows[0];

        const selectedData = await firstRow.toJSON({
            columns: ['ID', 'Task', 'Completion']
        });

        console.log('Selected columns:', selectedData);
        expect(selectedData).toHaveProperty('ID');
        expect(selectedData).toHaveProperty('Task');
        expect(selectedData).toHaveProperty('Completion');
    });
});
