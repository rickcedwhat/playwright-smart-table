import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

test.describe('Init Validation Errors', () => {
    test('throws error if no columns found', async ({ page }) => {
        // Create an empty table
        await page.setContent(`
            <table id="empty-table">
                <thead></thead>
                <tbody></tbody>
            </table>
        `);

        const table = useTable(page.locator('#empty-table'), {
            headerSelector: 'thead th'
        });

        // Should throw specific error
        await expect(table.init()).rejects.toThrow(/Initialization Error: No columns found/);
    });

    test('throws error if duplicate columns exist', async ({ page }) => {
        // Create table with duplicate headers
        await page.setContent(`
            <table id="dup-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Name</th> <!-- Duplicate -->
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `);

        const table = useTable(page.locator('#dup-table'), {
            headerSelector: 'thead th'
        });

        await expect(table.init()).rejects.toThrow(/Initialization Error: Duplicate column names found: "Name"/);
    });

    test('headerTransformer can fix duplicate errors', async ({ page }) => {
        await page.setContent(`
            <table id="fix-dup-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Name</th> <!-- Duplicate -->
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `);

        const table = useTable(page.locator('#fix-dup-table'), {
            headerSelector: 'thead th',
            // Use transformer to rename the second "Name"
            headerTransformer: ({ text, index }) => {
                if (text === 'Name' && index === 2) {
                    return 'Name (Secondary)';
                }
                return text;
            }
        });

        // Should NOT throw because we fixed the duplicate
        await expect(table.init()).resolves.not.toThrow();

        const headers = await table.getHeaders();
        expect(headers).toContain('Name');
        expect(headers).toContain('Name (Secondary)');
    });
});
