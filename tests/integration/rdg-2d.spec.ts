import { test, expect } from '@playwright/test';
import { useTable, presets } from '../../src/index';

const RDG_URL = 'https://comcast.github.io/react-data-grid/#/CommonFeatures';

test.describe('React Data Grid 2D (rdg2D preset)', () => {
    test.setTimeout(90000);

    test('collects all headers including those beyond the initial viewport', async ({ page }) => {
        await page.goto(RDG_URL, { waitUntil: 'domcontentloaded' });

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, { ...presets.rdg2D });
        await table.init();

        const headers = await table.getHeaders();
        expect(headers.length).toBeGreaterThanOrEqual(15);
        expect(headers).toContain('ID');
        expect(headers).toContain('Task');
    });

    test('reads all columns for a row without "could not reach cell" errors', async ({ page }) => {
        await page.goto(RDG_URL, { waitUntil: 'domcontentloaded' });

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, { ...presets.rdg2D });
        await table.init();

        const rows = await table.findRows({}, { maxPages: 1 });
        expect(rows.length).toBeGreaterThan(0);

        const rowData = await rows[0].toJSON();
        expect(Object.keys(rowData).length).toBeGreaterThanOrEqual(15);
        expect(rowData).toHaveProperty('ID');
        expect(rowData).toHaveProperty('Task');
    });

    test('map collects unique rows across pages without stale-locator errors', async ({ page }) => {
        await page.goto(RDG_URL, { waitUntil: 'domcontentloaded' });

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, {
            ...presets.rdg2D,
            strategies: {
                ...presets.rdg2D.strategies,
                dedupe: async (row) => row.getCell('ID').innerText(),
            },
        });

        await table.init();

        const rows = await table.map(
            ({ row }) => row.toJSON({ columns: ['ID', 'Task'] }),
            { maxPages: 4 },
        );

        const dataRows = rows.filter((r: any) => r.ID !== 'Total');
        expect(dataRows.length).toBeGreaterThanOrEqual(50);

        // All IDs must be valid positive integers
        expect(dataRows.every((r: any) => /^\d+$/.test(String(r.ID)))).toBe(true);

        // No duplicates
        const uniqueIds = new Set(dataRows.map((r: any) => r.ID));
        expect(uniqueIds.size).toBe(dataRows.length);
    });

    test('getCell works for columns at different horizontal positions', async ({ page }) => {
        await page.goto(RDG_URL, { waitUntil: 'domcontentloaded' });

        const grid = page.locator('[role="grid"]').first();
        await expect(grid).toBeAttached({ timeout: 10000 });

        const table = useTable(grid, { ...presets.rdg2D });
        await table.init();

        const rows = await table.findRows({}, { maxPages: 1 });
        const firstRow = rows[0];

        const data = await firstRow.toJSON({ columns: ['ID', 'Task', 'Completion'] });
        expect(data).toHaveProperty('ID');
        expect(data).toHaveProperty('Task');
        expect(data).toHaveProperty('Completion');
    });
});
