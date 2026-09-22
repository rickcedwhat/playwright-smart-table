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

    test('getRow rejects columnOverrides.read filters (#429)', async ({ page }) => {
        await page.setContent(TABLE);
        const table = await makeTable(page).init();

        expect(() => table.getRow({ Link: '/d/beta' } as any)).toThrow(
            /columnOverrides\.read.*findRow/
        );
    });
});

test.describe('getRow/findRow with getCellLocator (#429)', () => {
    // Column B is missing from the middle row's DOM order — nth(1) would hit the wrong cell.
    const VIRTUALIZED = `
        <table id="t">
            <thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>
            <tbody>
                <tr>
                    <td aria-colindex="1">A0</td>
                    <td aria-colindex="2">B0</td>
                    <td aria-colindex="3">C0</td>
                </tr>
                <tr>
                    <td aria-colindex="2">TargetB</td>
                    <td aria-colindex="3">C1</td>
                </tr>
                <tr>
                    <td aria-colindex="1">A2</td>
                    <td aria-colindex="3">C2</td>
                </tr>
            </tbody>
        </table>
    `;

    const makeTable = (page: Page) =>
        useTable(page.locator('#t'), {
            strategies: {
                getCellLocator: ({ row, columnIndex }) =>
                    row.locator(`[aria-colindex="${columnIndex + 1}"]`),
            },
        });

    test('getRow matches aria-colindex cell, not nth DOM order', async ({ page }) => {
        await page.setContent(VIRTUALIZED);
        const table = await makeTable(page).init();

        const row = table.getRow({ B: 'TargetB' }, { exact: true });
        await expect(row).toBeVisible();
        // Middle row has no mounted column A — assert only cells present in the window.
        await expect(row.getCell('B')).toHaveText('TargetB');
        await expect(row.getCell('C')).toHaveText('C1');
    });

    test('findRow matches aria-colindex cell, not nth DOM order', async ({ page }) => {
        await page.setContent(VIRTUALIZED);
        const table = await makeTable(page).init();

        const row = await table.findRow({ B: 'TargetB' }, { exact: true });
        await expect(row.getCell('B')).toHaveText('TargetB');
        await expect(row.getCell('C')).toHaveText('C1');
    });

    test('nth-based filtering would miss TargetB (control)', async ({ page }) => {
        await page.setContent(VIRTUALIZED);
        // No getCellLocator — historic .nth(colIndex) path cannot find B=TargetB
        // because TargetB sits at DOM position 0, not 1.
        const table = await useTable(page.locator('#t')).init();
        await expect(table.getRow({ B: 'TargetB' }, { exact: true })).not.toBeVisible();
    });
});
