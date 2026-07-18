import { test, expect } from '@playwright/test';
import { useTable, Strategies } from '../src';
import type { ViewportStrategy } from '../src/types';

// ─── Shared HTML builders ──────────────────────────────────────────────────────

/**
 * Builds an HTML page with a horizontally virtualized table.
 * Columns 1–3 always present; column 4 (Country) mounts when scrollLeft >= 200.
 * Rows are NOT evicted by horizontal scrolling (1D horizontal virtualization only).
 */
function makeHorizontalVirtHtml(rowCount: number) {
    const rows = Array.from({ length: rowCount }, (_, i) => `
        <div role="row" class="row" aria-rowindex="${i + 2}" style="top: ${i * 30}px;">
            <div role="gridcell" aria-colindex="1" class="cell col-1">${i + 1}</div>
            <div role="gridcell" aria-colindex="2" class="cell col-2">Name-${i + 1}</div>
            <div role="gridcell" aria-colindex="3" class="cell col-3">email${i + 1}@test.com</div>
        </div>`).join('\n');

    return `<!DOCTYPE html><html>
        <style>
            .table-container { width: 300px; height: 200px; overflow: auto; position: relative; }
            .viewport { width: 500px; }
            .grid { display: block; position: relative; }
            .header { display: flex; position: sticky; top: 0; background: #eee; }
            .row { display: flex; border-bottom: 1px solid #ddd; position: absolute; width: 100%; height: 30px; }
            .cell { position: absolute; width: 120px; padding: 5px; box-sizing: border-box; background: white; }
            .col-1 { left: 0px; } .col-2 { left: 120px; } .col-3 { left: 240px; } .col-4 { left: 360px; }
        </style>
        <body>
            <div class="table-container" id="scroller">
                <div class="viewport">
                    <div role="grid" class="grid">
                        <div class="header" role="row">
                            <div role="columnheader" aria-colindex="1" class="cell col-1">ID</div>
                            <div role="columnheader" aria-colindex="2" class="cell col-2">Name</div>
                            <div role="columnheader" aria-colindex="3" class="cell col-3">Email</div>
                        </div>
                        ${rows}
                    </div>
                </div>
            </div>
            <script>
                const scroller = document.getElementById('scroller');
                const COUNTRIES = ['USA','Canada','UK','Germany','France','Japan','Brazil','Australia','India','Mexico'];
                scroller.addEventListener('scroll', () => {
                    const header = document.querySelector('.header[role="row"]');
                    const rows = document.querySelectorAll('.row[aria-rowindex]');
                    if (scroller.scrollLeft >= 200) {
                        if (!header.querySelector('[aria-colindex="4"]')) {
                            const th = document.createElement('div');
                            th.setAttribute('role','columnheader'); th.setAttribute('aria-colindex','4');
                            th.className = 'cell col-4 mounted-col4';
                            th.innerText = 'Country'; header.appendChild(th);
                        }
                        rows.forEach((r, i) => {
                            if (!r.querySelector('[aria-colindex="4"]')) {
                                const cell = document.createElement('div');
                                cell.setAttribute('role','gridcell'); cell.setAttribute('aria-colindex','4');
                                cell.className = 'cell col-4 mounted-col4';
                                cell.innerText = COUNTRIES[i % COUNTRIES.length]; r.appendChild(cell);
                            }
                        });
                    } else {
                        document.querySelectorAll('.mounted-col4').forEach(c => c.remove());
                    }
                });
            </script>
        </body></html>`;
}

/**
 * Builds a 2D virtualized table: columns AND rows are evicted based on scroll position.
 * - Column 4 mounts when scrollLeft >= 150.
 * - Only rows whose aria-rowindex falls within the current vertical window are in the DOM.
 * The vertical window shifts when the user scrolls horizontally (simulating CSS Grid RDG
 * behaviour where the whole grid re-renders on any scroll event).
 *
 * Used to verify that scrollToRow is NOT called in synchronized map() — calling it would
 * snap the vertical window to one row and evict all peers in the batch.
 */
function make2DVirtHtml(rowCount: number, windowSize = 5) {
    return `<!DOCTYPE html><html>
        <style>
            .container { width: 300px; height: 200px; overflow: auto; position: relative; }
            .viewport { width: 600px; height: ${rowCount * 30 + 30}px; position: relative; }
            .grid { position: relative; width: 100%; }
            .header-row { display: flex; position: sticky; top: 0; background: #eee; z-index: 10; height: 30px; }
            .data-row { display: flex; position: absolute; height: 30px; width: 100%; }
            .cell { width: 140px; padding: 4px; box-sizing: border-box; background: white; border-bottom: 1px solid #ddd; overflow: hidden; }
            .col4 { left: 420px; position: absolute; }
        </style>
        <body>
            <div class="container" id="scroller">
                <div class="viewport">
                    <div role="grid" class="grid" id="grid">
                        <div class="header-row" role="row">
                            <div role="columnheader" aria-colindex="1" class="cell">ID</div>
                            <div role="columnheader" aria-colindex="2" class="cell">Name</div>
                            <div role="columnheader" aria-colindex="3" class="cell">Email</div>
                        </div>
                    </div>
                </div>
            </div>
            <script>
                const ROW_COUNT = ${rowCount};
                const WIN = ${windowSize};
                const COUNTRIES = ['USA','Canada','UK','Germany','France','Japan','Brazil','Australia','India','Mexico'];
                const scroller = document.getElementById('scroller');
                const grid = document.getElementById('grid');

                function renderRows() {
                    // Remove old data rows
                    grid.querySelectorAll('.data-row').forEach(r => r.remove());
                    grid.querySelector('.col4-header')?.remove();

                    const showCol4 = scroller.scrollLeft >= 150;
                    const firstVisible = Math.floor(scroller.scrollTop / 30);
                    const start = Math.max(0, firstVisible);
                    const end = Math.min(ROW_COUNT - 1, start + WIN - 1);

                    // Update col4 header
                    const header = grid.querySelector('.header-row');
                    if (showCol4 && !header.querySelector('[aria-colindex="4"]')) {
                        const th = document.createElement('div');
                        th.setAttribute('role','columnheader'); th.setAttribute('aria-colindex','4');
                        th.className = 'cell col4 col4-header'; th.innerText = 'Country';
                        header.appendChild(th);
                    } else if (!showCol4) {
                        header.querySelector('[aria-colindex="4"]')?.remove();
                    }

                    for (let i = start; i <= end; i++) {
                        const row = document.createElement('div');
                        row.className = 'data-row'; row.setAttribute('role','row');
                        row.setAttribute('aria-rowindex', String(i + 2));
                        row.style.top = (i * 30 + 30) + 'px';

                        [[1,String(i+1)],[2,'Name-'+(i+1)],[3,'email'+(i+1)+'@test.com']].forEach(([ci, text]) => {
                            const c = document.createElement('div');
                            c.setAttribute('role','gridcell'); c.setAttribute('aria-colindex', String(ci));
                            c.className = 'cell'; c.innerText = String(text); row.appendChild(c);
                        });

                        if (showCol4) {
                            const c4 = document.createElement('div');
                            c4.setAttribute('role','gridcell'); c4.setAttribute('aria-colindex','4');
                            c4.className = 'cell col4'; c4.innerText = COUNTRIES[i % COUNTRIES.length];
                            row.appendChild(c4);
                        }
                        grid.appendChild(row);
                    }
                }

                scroller.addEventListener('scroll', renderRows);
                renderRows(); // Initial render
            </script>
        </body></html>`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Viewport strategy — synchronized map()', () => {
    test('reads all columns across multiple rows using dataAttribute viewport', async ({ page }) => {
        await page.setContent(makeHorizontalVirtHtml(4));
        await page.waitForTimeout(200);

        const COUNTRIES = ['USA', 'Canada', 'UK', 'Germany'];

        const table = useTable(page.locator('[role="grid"]'), {
            rowSelector: '.row[aria-rowindex]',
            cellSelector: '[role="gridcell"]',
            headerSelector: '[role="columnheader"]',
            strategies: {
                header: async ({ resolve, config, root, page: p }) => {
                    const scroller = p.locator('#scroller');
                    const headerLoc = resolve(config.headerSelector, root);
                    const collected = new Set<string>();

                    await scroller.evaluate((el: HTMLElement) => el.scrollLeft = 0);
                    await p.waitForTimeout(100);
                    let last = 0;
                    for (let i = 0; i < 10; i++) {
                        (await headerLoc.allInnerTexts()).forEach(t => collected.add(t.trim()));
                        if (collected.size === last) break;
                        last = collected.size;
                        await scroller.evaluate((el: HTMLElement) => el.scrollLeft += 250);
                        await p.waitForTimeout(100);
                    }
                    await scroller.evaluate((el: HTMLElement) => el.scrollLeft = 0);
                    await p.waitForTimeout(100);
                    return Array.from(collected);
                },
                getCellLocator: ({ row, columnIndex }) =>
                    row.locator(`[aria-colindex="${columnIndex + 1}"]`),
                viewport: Strategies.Viewport.dataAttribute({
                    scrollContainer: '#scroller',
                    rowAttribute: 'aria-rowindex',
                    columnAttribute: 'aria-colindex',
                    rowOffset: 2,
                    columnOffset: 1,
                    attachTimeout: 3000,
                }),
            },
        });

        await table.init();

        // map() defaults to synchronized — all rows in the batch share one barrier
        const results = await table.map(({ row }) => row.toJSON({ columns: ['ID', 'Name', 'Country'] }));

        expect(results).toHaveLength(4);
        results.forEach((r, i) => {
            expect(r).toEqual({ ID: String(i + 1), Name: `Name-${i + 1}`, Country: COUNTRIES[i] });
        });
    });

    test('does not call scrollToRow in synchronized mode when row appears out-of-range after col scroll', async ({ page }) => {
        // 2D virtualized fixture: scrolling horizontally shifts which rows are in the DOM.
        // Before fix: scrollToRow(rowIndex) was called inside the barrier, snapping the
        // vertical window to one row and evicting all peers — causing timeouts for the rest.
        // After fix: scrollToRow is skipped when barrier is active; all rows are read correctly.
        await page.setContent(make2DVirtHtml(10, 5));
        await page.waitForTimeout(200);

        const table = useTable(page.locator('[role="grid"]'), {
            rowSelector: '.data-row[aria-rowindex]',
            cellSelector: '[role="gridcell"]',
            headerSelector: '[role="columnheader"]',
            strategies: {
                header: async ({ resolve, config, root, page: p }) => {
                    const scroller = p.locator('#scroller');
                    const headerLoc = resolve(config.headerSelector, root);
                    const collected = new Set<string>();
                    await scroller.evaluate((el: HTMLElement) => el.scrollLeft = 0);
                    await p.waitForTimeout(100);
                    let last = 0;
                    for (let i = 0; i < 10; i++) {
                        (await headerLoc.allInnerTexts()).forEach(t => collected.add(t.trim()));
                        if (collected.size === last) break;
                        last = collected.size;
                        await scroller.evaluate((el: HTMLElement) => el.scrollLeft += 200);
                        await p.waitForTimeout(100);
                    }
                    await scroller.evaluate((el: HTMLElement) => el.scrollLeft = 0);
                    await p.waitForTimeout(100);
                    return Array.from(collected);
                },
                getCellLocator: ({ row, columnIndex }) =>
                    row.locator(`[aria-colindex="${columnIndex + 1}"]`),
                viewport: Strategies.Viewport.dataAttribute({
                    scrollContainer: '#scroller',
                    rowAttribute: 'aria-rowindex',
                    columnAttribute: 'aria-colindex',
                    rowOffset: 2,
                    columnOffset: 1,
                    attachTimeout: 4000,
                }),
                dedupe: async (row) => row.getAttribute('aria-rowindex'),
            },
            maxPages: 1,
        });

        await table.init();
        const headers = await table.getHeaders();
        expect(headers).toContain('Country');

        // map() in synchronized mode — before fix, scrollToRow would evict peers
        const results = await table.map(({ row }) => row.toJSON({ columns: ['ID', 'Country'] }), { maxPages: 1 });

        expect(results.length).toBeGreaterThan(0);
        results.forEach(r => {
            expect(r.ID).toMatch(/^\d+$/);
            expect(r.Country).toBeTruthy();
        });
    });
});

// ─── ViewportStrategies.dataAttribute estimated-width fallback ────────────────
//
// When scrollToColumn() is called for a column index whose header element is
// not yet in the DOM, the strategy must estimate the scroll offset from the
// widths of the currently-visible headers (or fall back to 120 px) and still
// bring the target cell into view.

test.describe('Viewport strategy — estimated-width fallback', () => {
    test('scrollToColumn scrolls to correct position when target header is not yet mounted', async ({ page }) => {
        // makeHorizontalVirtHtml creates headers for columns 1-3 only.
        // Column 4 (aria-colindex="4") mounts via the scroll event once scrollLeft >= 200.
        await page.setContent(makeHorizontalVirtHtml(3));
        await page.waitForTimeout(200);

        const vp: ViewportStrategy = Strategies.Viewport.dataAttribute({
            scrollContainer: '#scroller',
            rowAttribute: 'aria-rowindex',
            columnAttribute: 'aria-colindex',
            rowOffset: 2,
            columnOffset: 1,
        });

        const context = {
            root: page.locator('[role="grid"]'),
            config: {
                rowSelector: '.row[aria-rowindex]',
                headerSelector: '[role="columnheader"]',
                cellSelector: '[role="gridcell"]',
            },
        } as any;

        // Column index 3 maps to aria-colindex="4" (colOffset=1).
        // The header for index 3 is not in the DOM initially, so the strategy
        // falls back to an estimated width from the three visible headers.
        if (!vp.scrollToColumn) throw new Error('scrollToColumn not implemented');
        await vp.scrollToColumn(context, 3);

        // The container must have scrolled (was 0 before the call)
        const scrollLeft = await page.evaluate(
            () => (document.querySelector('#scroller') as HTMLElement).scrollLeft
        );
        expect(scrollLeft).toBeGreaterThan(0);

        // The target cell must now be attached (mounted by the scroll-event handler)
        await expect(
            page.locator('.row[aria-rowindex] [aria-colindex="4"]').first()
        ).toBeAttached();
    });
});

// ─── getVisibleRowRange geometry (#353) ──────────────────────────────────────
//
// The dataAttribute strategy must report only rows actually within the scroll
// container's vertical bounds — not every mounted row. makeHorizontalVirtHtml
// never evicts rows vertically, so all N rows stay in the DOM while only those
// overlapping the 200px viewport are "visible".

test.describe('Viewport strategy — getVisibleRowRange geometry (#353)', () => {
    const makeContext = (page: import('@playwright/test').Page) => ({
        root: page.locator('[role="grid"]'),
        config: {
            rowSelector: '.row[aria-rowindex]',
            headerSelector: '[role="columnheader"]',
            cellSelector: '[role="gridcell"]',
        },
    } as any);

    const vp: ViewportStrategy = Strategies.Viewport.dataAttribute({
        scrollContainer: '#scroller',
        rowAttribute: 'aria-rowindex',
        rowOffset: 2,
    });

    test('excludes overscan rows below the fold', async ({ page }) => {
        // 10 rows × 30px in a 200px container: all 10 are mounted, but rows ~7–9 sit
        // entirely below the fold. Before #353, getVisibleRowRange returned {0,9}.
        await page.setContent(makeHorizontalVirtHtml(10));
        await page.waitForTimeout(100);

        if (!vp.getVisibleRowRange) throw new Error('getVisibleRowRange not implemented');
        const range = await vp.getVisibleRowRange(makeContext(page));

        expect(range.first).toBe(0);
        expect(range.last).toBeLessThan(9);          // overscan rows excluded (was 9)
        expect(range.last).toBeGreaterThanOrEqual(5); // several rows genuinely visible
    });

    test('tracks scroll position (top rows drop out once scrolled)', async ({ page }) => {
        await page.setContent(makeHorizontalVirtHtml(10));
        await page.waitForTimeout(100);
        await page.locator('#scroller').evaluate((el: HTMLElement) => { el.scrollTop = 90; });
        await page.waitForTimeout(50);

        if (!vp.getVisibleRowRange) throw new Error('getVisibleRowRange not implemented');
        const range = await vp.getVisibleRowRange(makeContext(page));

        expect(range.first).toBeGreaterThanOrEqual(2); // rows 0–1 scrolled out of view
    });
});

