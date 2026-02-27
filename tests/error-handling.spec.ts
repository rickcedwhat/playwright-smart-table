import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

test.describe('Error Handling and Validation', () => {

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

    test.describe('Smart Error Suggestions', () => {
        test('shows helpful suggestions for misspelled column names', async ({ page }) => {
            await page.goto('https://datatables.net/examples/data_sources/dom');

            const table = await useTable(page.locator('#example')).init();
            const row = table.getRow({ Name: 'Airi Satou' });

            // Try to access a misspelled column
            try {
                row.getCell('Positon'); // Typo: should be 'Position'
                throw new Error('Should have thrown');
            } catch (error: any) {
                // Verify error message includes suggestions
                expect(error.message).toContain('Column \'Positon\' not found');
                expect(error.message).toContain('Did you mean:');
                expect(error.message).toContain('Position');
                expect(error.message).toContain('% match');
                expect(error.message).toContain('Available columns:');
                expect(error.message).toContain('Tip: Column names are case-sensitive');
            }
        });

        test('shows suggestions for case mismatch', async ({ page }) => {
            await page.goto('https://datatables.net/examples/data_sources/dom');

            const table = await useTable(page.locator('#example')).init();
            const row = table.getRow({ Name: 'Airi Satou' });

            // Try lowercase when it should be capitalized
            try {
                row.getCell('position'); // Should be 'Position'
                throw new Error('Should have thrown');
            } catch (error: any) {
                expect(error.message).toContain('position');
                expect(error.message).toContain('Position');
            }
        });

        test('shows helpful suggestions for invalid filter columns in findRow', async ({ page }) => {
            await page.goto('https://datatables.net/examples/data_sources/dom');

            const table = await useTable(page.locator('#example')).init();

            // Try to filter by a misspelled column
            try {
                await table.findRow({ 'Positon': 'Accountant' }); // Typo: should be 'Position'
                throw new Error('Should have thrown');
            } catch (error: any) {
                expect(error.message).toContain("Column 'Positon' not found");
                expect(error.message).toContain('Did you mean:');
                expect(error.message).toContain('Position');
            }
        });
    });

    test.describe('Smart Initialization Checks', () => {
        test('should wait for headers to appear (smart init)', async ({ page }) => {
            // 1. Start with empty table
            await page.setContent(`
                <div id="target">
                    <table>
                        <thead>
                            <tr id="header-row"></tr>
                        </thead>
                        <tbody>
                            <tr><td>Wait...</td></tr>
                        </tbody>
                    </table>
                </div>
            `);

            // 2. Configure table
            const table = useTable(page.locator('table'), {
                // Use default smart init (isHeaderLoading: stable(200))
            });

            // 3. Schedule header injection after 1000ms
            // This is longer than the default "visible" timeout check loop (which is fast), 
            // but shorter than the default total timeout (3000ms).
            await page.evaluate(() => {
                setTimeout(() => {
                    const tr = document.getElementById('header-row');
                    if (tr) {
                        tr.innerHTML = '<th>ID</th><th>Name</th>';
                    }
                }, 1000);
            });

            // 4. Init should wait and succeed
            const start = Date.now();
            await table.init();
            const duration = Date.now() - start;

            // Should have taken at least 1000ms (for headers) + 200ms (stability check)
            expect(duration).toBeGreaterThan(1100);
            expect(await table.getHeaders()).toEqual(['ID', 'Name']);
        });

        test('should wait for headers to stabilize (changing count)', async ({ page }) => {
            // 1. Start with initial headers
            await page.setContent(`
                <table>
                    <thead>
                        <tr id="header-row">
                            <th>Col 1</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            `);

            // Enable debug logging to see retries
            const table = useTable(page.locator('table'), {
                debug: { logLevel: 'verbose' }
            });

            // 2. Schedule updates: 
            await page.evaluate(() => {
                const tr = document.getElementById('header-row')!;
                let count = 1;
                const interval = setInterval(() => {
                    count++;
                    // Use insertAdjacentHTML which is safer than innerHTML +=
                    tr.insertAdjacentHTML('beforeend', `<th>Col ${count}</th>`);
                    if (count === 5) clearInterval(interval);
                }, 100);
            });

            await table.init();

            // It should wait until updates stop (5 columns)
            expect(await table.getHeaders()).toHaveLength(5);
        });
    });
});
