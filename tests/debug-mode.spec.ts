import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

test.describe('Debug Mode', () => {
    test('No debug mode works normally (performance check)', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        const table = useTable(page.locator('#example'), {
            headerSelector: 'thead th'
            // No debug config
        });

        // Should be fast without delays
        const start = Date.now();
        await table.init();
        const elapsed = Date.now() - start;

        // Verify functionality
        const row = await table.getRow({ Name: 'Airi Satou' });
        expect(row).toBeDefined();

        // Should be much faster than with delays (typically < 100ms locally, but can be ~700ms in CI)
        expect(elapsed).toBeLessThan(1000);
    });

    test('Delays work correctly', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        const table = useTable(page.locator('#example'), {
            headerSelector: 'thead th',
            debug: {
                slow: 500,  // 500ms delay
                logLevel: 'info'
            }
        });

        // Init should take at least 500ms due to delay
        const start = Date.now();
        await table.init();
        const elapsed = Date.now() - start;

        expect(elapsed).toBeGreaterThanOrEqual(450); // Small margin for error
    });

    test('Granular delays work', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        const table = useTable(page.locator('#example'), {
            headerSelector: 'thead th',
            debug: {
                slow: {
                    default: 800,
                    findRow: 100
                },
                logLevel: 'info'
            }
        });

        // Init should use default delay (800ms)
        const start = Date.now();
        await table.init();
        const elapsed = Date.now() - start;

        expect(elapsed).toBeGreaterThanOrEqual(750);
    });

    test('FindRow with delays', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        const table = useTable(page.locator('#example'), {
            headerSelector: 'thead th',
            debug: {
                slow: {
                    findRow: 600
                },
                logLevel: 'info'
            }
        });

        await table.init();

        // FindRow should take at least 600ms
        const start = Date.now();
        await table.findRow({ Name: 'Airi Satou' });
        const elapsed = Date.now() - start;

        expect(elapsed).toBeGreaterThanOrEqual(550);
    });

    test('Combined debug features', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        const table = useTable(page.locator('#example'), {
            headerSelector: 'thead th',
            debug: {
                slow: 200,                   // 200ms delays
                logLevel: 'info'             // Info-level logging
            }
        });

        await table.init();
        const row = await table.getRow({ Name: 'Airi Satou' });
        expect(row).toBeDefined();
    });

    test('Verbose logging can be enabled', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        // This test just verifies verbose mode doesn't crash
        const table = useTable(page.locator('#example'), {
            headerSelector: 'thead th',
            debug: {
                logLevel: 'verbose'
            }
        });

        await table.init();
        await table.findRow({ Name: 'Airi Satou' });

        // If we got here without errors, verbose logging works
        expect(true).toBe(true);
    });

    test('Debug: Check pagination button', async ({ page }) => {
        await page.goto("https://mui.com/material-ui/react-table/");
        await page.locator('.MuiDataGrid-root').first().scrollIntoViewIfNeeded();

        const tableLocator = page.locator(".MuiDataGrid-root").first();

        // First, let's manually check if the button exists
        const nextButton = tableLocator.getByRole("button", { name: "Go to next page" });
        console.log("Next button count:", await nextButton.count());

        if (await nextButton.count() > 0) {
            console.log("✅ Next button found");
            console.log("Is enabled:", await nextButton.isEnabled());
            console.log("Is visible:", await nextButton.isVisible());
        } else {
            console.log("❌ Next button NOT found");
            // Let's see what buttons are available
            const allButtons = await tableLocator.getByRole("button").all();
            console.log(`Found ${allButtons.length} buttons in table`);
            for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
                const text = await allButtons[i].textContent();
                const label = await allButtons[i].getAttribute('aria-label');
                console.log(`  Button ${i}: text="${text}", aria-label="${label}"`);
            }
        }

        // Now let's check what data is actually in the table
        const table = useTable(tableLocator, {
            rowSelector: ".MuiDataGrid-row",
            headerSelector: ".MuiDataGrid-columnHeader",
            cellSelector: ".MuiDataGrid-cell",
            headerTransformer: ({ text }) => text.includes('__col_') ? "Actions" : text,
            debug: {
                logLevel: 'verbose'
            }
        });

        await table.init();

        // Get all last names on the current page
        const lastNames = await table.getColumnValues("Last name");
        console.log("Last names on page 1:", lastNames);
        console.log("Is 'Clifford' on page 1?", lastNames.includes("Clifford"));
    });
});
