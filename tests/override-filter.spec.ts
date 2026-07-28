import { test, expect, type Page } from '@playwright/test';
import { useTable } from '../src/index';

const TABLE = `
    <table id="t">
        <thead><tr><th>Name</th><th>Link</th><th>Status</th></tr></thead>
        <tbody>
            <tr><td>Alpha</td><td><a href="/d/alpha">link</a></td><td>Active</td></tr>
            <tr><td>Beta</td><td><a href="/d/beta">link</a></td><td>Active</td></tr>
            <tr><td>Gamma</td><td><a href="/d/gamma">link</a></td><td>Inactive</td></tr>
        </tbody>
    </table>
`;

test.describe('findRow/findRows with columnOverride filters (#385)', () => {
    const makeTable = (page: Page) =>
        useTable(page.locator('#t'), {
            columnOverrides: {
                Link: {
                    read: async (cell) => {
                        const anchor = cell.locator('a');
                        if (await anchor.count() > 0) {
                            return await anchor.getAttribute('href') ?? cell.innerText();
                        }
                        return cell.innerText();
                    },
                },
            },
        });

    test('findRow filters on override-produced value', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();

        const row = await table.findRow({ Link: '/d/beta' }, { exact: true });
        const data = await row.toJSON() as Record<string, string>;
        expect(data.Name).toBe('Beta');
    });

    test('findRows filters on override-produced value', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();

        const rows = await table.findRows({ Link: '/d/beta' }, { exact: true });
        expect(rows.length).toBe(1);
        const data = await rows[0].toJSON() as Record<string, string>;
        expect(data.Name).toBe('Beta');
    });

    test('findRow combines DOM filter + override filter', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();

        const row = await table.findRow({ Status: 'Active', Link: '/d/alpha' }, { exact: true });
        const data = await row.toJSON() as Record<string, string>;
        expect(data.Name).toBe('Alpha');
    });

    test('findRow throws Ambiguous when override filter matches multiple', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();

        await expect(
            table.findRow({ Link: '/d/' })
        ).rejects.toThrow(/Ambiguous Row/);
    });

    test('countRows with override filter counts only matching rows', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();

        expect(await table.countRows({ Link: '/d/alpha' }, { exact: true })).toBe(1);
        expect(await table.countRows({ Link: '/d/' })).toBe(3);
        expect(await table.countRows({ Link: '/d/nonexistent' }, { exact: true })).toBe(0);
    });
});
