import { test, expect } from '@playwright/test';
import { useTable } from '../src';

const TABLE_HTML = `
  <table id="t">
    <thead><tr><th>Name</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td>Alice</td><td>Active</td></tr>
    </tbody>
  </table>
`;

const EMPTY_STATE_HTML = `
  <div class="empty-state">No results found</div>
`;

test.describe('emptyState config (#379)', () => {
    test('init succeeds and isEmpty returns true when emptyState is visible', async ({ page }) => {
        await page.setContent(EMPTY_STATE_HTML);

        const table = await useTable(page.locator('#t'), {
            emptyState: page.locator('.empty-state'),
        }).init();

        expect(table.isInitialized()).toBe(true);
        expect(table.isEmpty()).toBe(true);
    });

    test('init succeeds normally when table has data (isEmpty false)', async ({ page }) => {
        await page.setContent(TABLE_HTML);

        const table = await useTable(page.locator('#t'), {
            emptyState: page.locator('.empty-state'),
        }).init();

        expect(table.isInitialized()).toBe(true);
        expect(table.isEmpty()).toBe(false);
    });

    test('init throws when headers fail and emptyState is not visible', async ({ page }) => {
        await page.setContent('<div>something else entirely</div>');

        const table = useTable(page.locator('#t'), {
            emptyState: page.locator('.empty-state'),
        });

        await expect(table.init()).rejects.toThrow();
    });

    test('init throws when headers fail and no emptyState configured', async ({ page }) => {
        await page.setContent(EMPTY_STATE_HTML);

        const table = useTable(page.locator('#t'));

        await expect(table.init()).rejects.toThrow();
    });

    test('isEmpty returns false before init', async ({ page }) => {
        await page.setContent(EMPTY_STATE_HTML);

        const table = useTable(page.locator('#t'), {
            emptyState: page.locator('.empty-state'),
        });

        expect(table.isEmpty()).toBe(false);
    });

    test('repeated init calls return immediately in empty state', async ({ page }) => {
        await page.setContent(EMPTY_STATE_HTML);

        const table = await useTable(page.locator('#t'), {
            emptyState: page.locator('.empty-state'),
        }).init();

        expect(table.isEmpty()).toBe(true);

        // Second init should short-circuit, not re-throw.
        const same = await table.init();
        expect(same.isEmpty()).toBe(true);
    });

    test('getRow throws in empty state', async ({ page }) => {
        await page.setContent(EMPTY_STATE_HTML);

        const table = await useTable(page.locator('#t'), {
            emptyState: page.locator('.empty-state'),
        }).init();

        expect(() => table.getRow({ Name: 'Alice' })).toThrow();
    });

    test('findRow throws in empty state', async ({ page }) => {
        await page.setContent(EMPTY_STATE_HTML);

        const table = await useTable(page.locator('#t'), {
            emptyState: page.locator('.empty-state'),
        }).init();

        await expect(table.findRow({ Name: 'Alice' })).rejects.toThrow();
    });

    test('getHeaders throws in empty state', async ({ page }) => {
        await page.setContent(EMPTY_STATE_HTML);

        const table = await useTable(page.locator('#t'), {
            emptyState: page.locator('.empty-state'),
        }).init();

        await expect(table.getHeaders()).rejects.toThrow();
    });

    test('emptyState with both table and empty element — headers win', async ({ page }) => {
        await page.setContent(`
            ${TABLE_HTML}
            ${EMPTY_STATE_HTML}
        `);

        const table = await useTable(page.locator('#t'), {
            emptyState: page.locator('.empty-state'),
        }).init();

        expect(table.isEmpty()).toBe(false);
        const headers = await table.getHeaders();
        expect(headers).toEqual(['Name', 'Status']);
    });
});
