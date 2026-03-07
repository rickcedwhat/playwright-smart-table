import { test, expect } from '@playwright/test';
import { useTable, Strategies } from '../src';

test.describe('Horizontal Virtualization via aria-colindex', () => {
    // Simulates a react-data-grid-style table with 4 columns (continuous aria-colindex 1-4).
    // Column 4 (Country) is virtualized — unmounted when scrollLeft < 200, mounted when >= 200.
    test.beforeEach(async ({ page }) => {
        const html = `
            <!DOCTYPE html>
            <html>
                <style>
                    .table-container { width: 300px; height: 200px; overflow: auto; border: 1px solid #ccc; position: relative; }
                    .viewport { width: 500px; height: 200px; position: relative; }
                    .grid { display: block; position: relative; width: 100%; }
                    .header { display: flex; position: sticky; top: 0; background: #eee; z-index: 10; }
                    .row { display: flex; border-bottom: 1px solid #ddd; position: absolute; width: 100%; height: 30px; }
                    .cell { position: absolute; width: 120px; padding: 5px; box-sizing: border-box; background: white; white-space: nowrap; }
                    .col-1 { left: 0px; }
                    .col-2 { left: 120px; }
                    .col-3 { left: 240px; }
                    .col-4 { left: 360px; }
                </style>
                <body>
                    <div class="table-container" id="scroller">
                        <div class="viewport">
                            <div role="grid" class="grid">
                                <!-- Headers: cols 1-3 always visible, col 4 (Country) mounts on scroll -->
                                <div class="header" role="row">
                                    <div role="columnheader" aria-colindex="1" class="cell col-1">ID</div>
                                    <div role="columnheader" aria-colindex="2" class="cell col-2">Name</div>
                                    <div role="columnheader" aria-colindex="3" class="cell col-3">Email</div>
                                </div>

                                <!-- Rows: col 4 cells mount/unmount with scroll -->
                                <div role="row" class="row" aria-rowindex="2" style="top: 30px;">
                                    <div role="gridcell" aria-colindex="1" class="cell col-1">100</div>
                                    <div role="gridcell" aria-colindex="2" class="cell col-2">Alice</div>
                                    <div role="gridcell" aria-colindex="3" class="cell col-3">alice@example.com</div>
                                </div>
                                <div role="row" class="row" aria-rowindex="3" style="top: 60px;">
                                    <div role="gridcell" aria-colindex="1" class="cell col-1">101</div>
                                    <div role="gridcell" aria-colindex="2" class="cell col-2">Bob</div>
                                    <div role="gridcell" aria-colindex="3" class="cell col-3">bob@example.com</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <script>
                        const scroller = document.getElementById('scroller');
                        scroller.addEventListener('scroll', () => {
                            const rows = document.querySelectorAll('.row[aria-rowindex]');
                            const header = document.querySelector('.header[role="row"]');
                            if (scroller.scrollLeft >= 200) {
                                // Mount Country header
                                if (!header.querySelector('[aria-colindex="4"]')) {
                                    const th = document.createElement('div');
                                    th.setAttribute('role', 'columnheader');
                                    th.setAttribute('aria-colindex', '4');
                                    th.className = 'cell col-4 mounted-cell';
                                    th.innerText = 'Country';
                                    header.appendChild(th);
                                }
                                // Mount Country cells
                                rows.forEach((r, i) => {
                                    if (!r.querySelector('[aria-colindex="4"]')) {
                                        const cell = document.createElement('div');
                                        cell.setAttribute('role', 'gridcell');
                                        cell.setAttribute('aria-colindex', '4');
                                        cell.className = 'cell col-4 mounted-cell';
                                        cell.innerText = i === 0 ? 'USA' : 'Canada';
                                        r.appendChild(cell);
                                    }
                                });
                            } else {
                                document.querySelectorAll('.mounted-cell').forEach(c => c.remove());
                            }
                        });
                    </script>
                </body>
            </html>
        `;

        await page.setContent(html);
        await page.waitForTimeout(300);
    });

    test('should read horizontally virtualized columns using getCellLocator and navigation primitives', async ({ page }) => {
        const root = page.locator('[role="grid"]');
        const scroller = page.locator('#scroller');

        const table = useTable(root, {
            rowSelector: '.row[aria-rowindex]',
            cellSelector: '[role="gridcell"]',
            headerSelector: '[role="columnheader"]',
            strategies: {
                // Scroll left-to-right to discover all virtualized headers in order.
                // Returns plain string[] — array index + 1 == aria-colindex.
                header: async ({ resolve, config, root, page }) => {
                    const headerLoc = resolve(config.headerSelector, root);
                    const collected = new Set<string>();

                    await scroller.evaluate(el => el.scrollLeft = 0);
                    await page.waitForTimeout(100);

                    let lastSize = 0;
                    for (let i = 0; i < 10; i++) {
                        (await headerLoc.allInnerTexts()).forEach(t => collected.add(t.trim()));
                        if (collected.size === lastSize) break;
                        lastSize = collected.size;
                        await scroller.evaluate(el => el.scrollLeft += 250);
                        await page.waitForTimeout(100);
                    }

                    await scroller.evaluate(el => el.scrollLeft = 0);
                    await page.waitForTimeout(100);
                    return Array.from(collected);
                },

                // aria-colindex is 1-based; columnIndex from header array is 0-based.
                getCellLocator: ({ row, columnIndex }) =>
                    row.locator(`[aria-colindex="${columnIndex + 1}"]`),

                // _navigateToCell orchestrates goRight/goLeft automatically.
                navigation: {
                    goHome: async () => {
                        await scroller.evaluate(el => el.scrollLeft = 0);
                        await page.waitForTimeout(100);
                    },
                    goRight: async () => {
                        await scroller.evaluate(el => el.scrollLeft += 150);
                        await page.waitForTimeout(50);
                    },
                    goLeft: async () => {
                        await scroller.evaluate(el => el.scrollLeft -= 150);
                        await page.waitForTimeout(50);
                    },
                },
            }
        });

        await table.init();

        // Should successfully extract "Country" even though it's not mounted initially
        const results = await table.map(async ({ row }) => {
            return await row.toJSON({ columns: ['ID', 'Name', 'Country'] });
        });

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({ ID: '100', Name: 'Alice', Country: 'USA' });
        expect(results[1]).toEqual({ ID: '101', Name: 'Bob', Country: 'Canada' });

        // filter: only Canadian rows
        const filtered = await table.filter(async ({ row }) => {
            const data = await row.toJSON({ columns: ['Country'] });
            return data.Country === 'Canada';
        });
        expect(filtered).toHaveLength(1);
        expect(await filtered[0].toJSON({ columns: ['ID'] })).toEqual({ ID: '101' });

        // forEach: counts and spot-checks
        let count = 0;
        await table.forEach(async ({ row }) => {
            const data = await row.toJSON({ columns: ['ID', 'Country'] });
            if (data.ID === '100') expect(data.Country).toBe('USA');
            count++;
        });
        expect(count).toBe(2);
    });
});
