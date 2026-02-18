import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

test.describe('Smart Initialization', () => {
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
