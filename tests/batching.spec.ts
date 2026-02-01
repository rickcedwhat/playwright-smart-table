import { test, expect } from '@playwright/test';
import { useTable, Strategies } from '../src/index';

test.describe('Batching', () => {
    test('iterateThroughTable: Basic batching', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        const table = useTable(page.locator('#example'), {
            headerSelector: 'thead th',
            strategies: {
                pagination: Strategies.Pagination.clickNext(() =>
                    page.getByRole('link', { name: 'Next' })
                )
            },
            maxPages: 6  // Table has 57 entries = 6 pages
        });
        await table.init();

        const batchInfos: any[] = [];

        const results = await table.iterateThroughTable(
            async ({ rows, batchInfo }) => {
                if (batchInfo) {
                    batchInfos.push(batchInfo);
                }
                return rows.length;
            },
            { batchSize: 3 }
        );

        // Should have 2 batches (6 pages / 3 = 2)
        expect(results.length).toBe(2);
        expect(batchInfos.length).toBe(2);

        // First batch: pages 0,1,2
        expect(batchInfos[0].startIndex).toBe(0);
        expect(batchInfos[0].endIndex).toBe(2);
        expect(batchInfos[0].size).toBe(3);

        // Second batch: pages 3,4,5
        expect(batchInfos[1].startIndex).toBe(3);
        expect(batchInfos[1].endIndex).toBe(5);
        expect(batchInfos[1].size).toBe(3);
    });

    test('iterateThroughTable: batchSize=undefined is same as no batching', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        const table = useTable(page.locator('#example'), {
            headerSelector: 'thead th',
            strategies: {
                pagination: Strategies.Pagination.clickNext(() =>
                    page.getByRole('link', { name: 'Next' })
                )
            },
            maxPages: 6
        });
        await table.init();

        const batchInfos: any[] = [];

        const results = await table.iterateThroughTable(
            async ({ rows, batchInfo }) => {
                batchInfos.push(batchInfo);
                return rows.length;
            },
            { batchSize: undefined }
        );

        // Should have same number of callbacks as iterations
        expect(results.length).toBe(6);

        // batchInfo should be undefined for all
        expect(batchInfos.every(info => info === undefined)).toBe(true);
    });

    test('iterateThroughTable: batchSize=1 does not batch', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        const table = useTable(page.locator('#example'), {
            headerSelector: 'thead th',
            strategies: {
                pagination: Strategies.Pagination.clickNext(() =>
                    page.getByRole('link', { name: 'Next' })
                )
            },
            maxPages: 3
        });
        await table.init();

        const batchInfos: any[] = [];

        const results = await table.iterateThroughTable(
            async ({ rows, batchInfo }) => {
                batchInfos.push(batchInfo);
                return rows.length;
            },
            { batchSize: 1 }
        );

        // Should have same number of callbacks as iterations
        expect(results.length).toBe(3);

        // batchInfo should be undefined (batchSize=1 doesn't trigger batching)
        expect(batchInfos.every(info => info === undefined)).toBe(true);
    });

    test('iterateThroughTable: Batching with deduplication', async ({ page }) => {
        await page.goto('https://htmx.org/examples/infinite-scroll/');

        const table = useTable(page.locator('table'), {
            rowSelector: 'tbody tr',
            headerSelector: 'thead th',
            cellSelector: 'td',
            strategies: {
                pagination: Strategies.Pagination.infiniteScroll()
            },
            maxPages: 10
        });
        await table.init();

        const allNames: string[] = [];

        const results = await table.iterateThroughTable(
            async ({ rows }) => {
                const names = await Promise.all(
                    rows.map(r => r.getCell('Name').innerText())
                );
                allNames.push(...names);
                return names.length;
            },
            {
                batchSize: 3,
                dedupeStrategy: async (row) => {
                    return await row.getCell('Name').innerText();
                }
            }
        );

        // Should have deduplicated rows
        const uniqueNames = new Set(allNames);
        expect(uniqueNames.size).toBe(allNames.length);

        // Should have batched results
        expect(results.length).toBeLessThan(10);
    });

    test('iterateThroughTable: Batching with hooks', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        const table = useTable(page.locator('#example'), {
            headerSelector: 'thead th',
            strategies: {
                pagination: Strategies.Pagination.clickNext(() =>
                    page.getByRole('link', { name: 'Next' })
                )
            },
            maxPages: 6
        });
        await table.init();

        let beforeFirstCalled = false;
        let afterLastCalled = false;
        let beforeFirstIndex = -1;
        let afterLastIndex = -1;

        const results = await table.iterateThroughTable(
            async ({ rows }) => {
                return rows.length;
            },
            {
                batchSize: 3,
                beforeFirst: async ({ index }) => {
                    beforeFirstCalled = true;
                    beforeFirstIndex = index;
                },
                afterLast: async ({ index }) => {
                    afterLastCalled = true;
                    afterLastIndex = index;
                }
            }
        );

        expect(beforeFirstCalled).toBe(true);
        expect(afterLastCalled).toBe(true);
        expect(beforeFirstIndex).toBe(0);
        expect(afterLastIndex).toBe(3);  // Last batch starts at index 3
    });

    test('iterateThroughTable: Last batch smaller than batchSize', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        const table = useTable(page.locator('#example'), {
            headerSelector: 'thead th',
            strategies: {
                pagination: Strategies.Pagination.clickNext(() =>
                    page.getByRole('link', { name: 'Next' })
                )
            },
            maxPages: 5  // 5 pages / 3 batch = 2 batches (3, 2)
        });
        await table.init();

        const batchInfos: any[] = [];

        const results = await table.iterateThroughTable(
            async ({ rows, batchInfo }) => {
                if (batchInfo) {
                    batchInfos.push(batchInfo);
                }
                return rows.length;
            },
            { batchSize: 3 }
        );

        // 5 pages / 3 batch size = 2 batches (3, 2)
        expect(results.length).toBe(2);

        // First batch should have size 3
        expect(batchInfos[0].size).toBe(3);

        // Last batch should have size 2
        expect(batchInfos[1].size).toBe(2);
    });

    test('iterateThroughTable: Batching collects rows from multiple pages', async ({ page }) => {
        await page.goto('https://datatables.net/examples/data_sources/dom');
        await page.waitForSelector('#example_wrapper');

        const table = useTable(page.locator('#example'), {
            headerSelector: 'thead th',
            strategies: {
                pagination: Strategies.Pagination.clickNext(() =>
                    page.getByRole('link', { name: 'Next' })
                )
            },
            maxPages: 6
        });
        await table.init();

        const rowCounts: number[] = [];

        await table.iterateThroughTable(
            async ({ rows, batchInfo }) => {
                rowCounts.push(rows.length);
                if (batchInfo) {
                    // Rows should contain data from multiple pages
                    // Each page has 10 rows, so batch of 3 pages should have 30 rows
                    // (except last page which has 7 rows, so last batch has 10+10+7=27)
                    expect(rows.length).toBeGreaterThanOrEqual(27);
                    expect(rows.length).toBeLessThanOrEqual(30);
                }
                return rows.length;
            },
            { batchSize: 3 }
        );

        // Should have 2 batches (3 pages each)
        expect(rowCounts.length).toBe(2);

        // First batch: 10+10+10 = 30 rows
        expect(rowCounts[0]).toBe(30);

        // Second batch: 10+10+7 = 27 rows
        expect(rowCounts[1]).toBe(27);
    });
});
