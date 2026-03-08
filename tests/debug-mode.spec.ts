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
        const row = table.getRow({ Name: 'Airi Satou' });
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
        const row = table.getRow({ Name: 'Airi Satou' });
        expect(row).toBeDefined();
    });

    test('Verbose logging emits expected messages during map()', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        // logDebug runs in the Node test process — intercept console.log at the Node level
        const messages: string[] = [];
        const originalLog = console.log;
        console.log = (...args: any[]) => {
            messages.push(args.join(' '));
            originalLog(...args);
        };

        try {
            const table = useTable(page.locator('#example'), {
                headerSelector: 'thead th',
                debug: { logLevel: 'verbose' }
            });

            await table.init();

            // Run a 1-page map to get iteration log output
            await table.map(({ row }) => row.getCell('Name').innerText(), { maxPages: 1 });
        } finally {
            console.log = originalLog;
        }

        // Assert key verbose messages were emitted
        expect(messages.some(m => m.includes('map: starting'))).toBe(true);
        expect(messages.some(m => m.includes('map: scanning page'))).toBe(true);
        expect(messages.some(m => m.includes('map: complete'))).toBe(true);
    });

});

