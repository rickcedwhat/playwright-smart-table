/**
 * Bug #355 — dedupe is called before the row-loading wait, causing key instability
 * on skeleton rows.
 *
 * On virtual-scroll tables with lazy-loading content, a content-dependent dedupe key
 * (with a positional fallback for skeletons) changes between a row's first encounter
 * (skeleton) and a later re-scan (loaded). The deduplicator treats the loaded row as
 * new and appends a duplicate, out of order.
 *
 * The fix adds an isRowLoading wait to the map/forEach/filter pipeline
 * (engine/tableIteration.ts) that runs BEFORE the dedupe strategy — mirroring the
 * wait findRows already performs (engine/rowFinder.ts).
 */
import { test, expect, Page } from '@playwright/test';
import { useTable, Strategies } from '../src/index';

/**
 * Deterministic repro of the #355 core mechanism, with no virtualization/timing races.
 *
 * A fixed set of <tr> rows renders as skeletons, then loads real content after a short
 * page-side timer (models a lazy content fetch, independent of scrolling). A one-shot
 * goNext forces the engine to re-scan the SAME elements after their text has changed —
 * the ElementTracker re-flags them as unseen (textContent signature changed), which is
 * exactly what makes a virtual scroller re-present a row.
 *
 * dedupe key: content-based ('id:<n>') once loaded, positional ('pos:<n>') while skeleton.
 *
 * Without the fix: first scan computes 'pos:n' on the skeleton and commits it; the re-scan
 * computes 'id:n' on the loaded row → not in the set → appended as a duplicate.
 * With the fix: the first scan waits for load, computes 'id:n'; the re-scan computes 'id:n'
 * → deduped. No duplicate, regardless of engine timing.
 */
async function buildLazyLoadTable(page: Page, loadDelayMs: number) {
    await page.setContent(`
        <table id="t">
            <thead><tr><th>ID</th><th>Name</th></tr></thead>
            <tbody>
                ${[1, 2, 3, 4].map(n => `
                    <tr class="row" data-n="${n}">
                        <td class="cell skeleton" data-testid="skeleton"></td>
                        <td class="cell skeleton" data-testid="skeleton"></td>
                    </tr>`).join('')}
            </tbody>
        </table>
        <script>
            // Lazy content load, independent of any scroll/pagination.
            setTimeout(() => {
                document.querySelectorAll('tr.row').forEach(tr => {
                    const n = tr.getAttribute('data-n');
                    const cells = tr.querySelectorAll('td');
                    cells[0].textContent = String(n);
                    cells[1].textContent = 'Item ' + n;
                    cells.forEach(c => c.classList.remove('skeleton'));
                });
            }, ${loadDelayMs});
        </script>
    `);
}

const skeletonAwareDedupe = async (row: any) =>
    row.evaluate((el: Element) => {
        const isSkeleton = !!el.querySelector('.skeleton');
        if (isSkeleton) return 'pos:' + (el.getAttribute('data-n') ?? '?');
        const idCell = el.querySelector('td');
        return 'id:' + (idCell?.textContent ?? '').trim();
    });

async function setPlaygroundConfig(page: Page, config: any) {
    const json = JSON.stringify(config, null, 2);
    await page.locator('textarea').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.locator('textarea').fill(json);
    await page.getByRole('button', { name: 'Apply & Reload Table' }).click();
    try {
        await page.locator('.spinner').waitFor({ state: 'visible', timeout: 2000 });
    } catch (e) {
        // Reload may be too fast to catch the spinner
    }
    await expect(page.locator('.spinner')).not.toBeVisible();
}

/** Selectors for the virtualized playground table. */
const baseTableConfig = {
    rowSelector: '.virtual-row',
    headerSelector: '.header [role="columnheader"]',
    cellSelector: '[role="cell"]',
};

test.describe('Bug #355 — row loading wait must run before dedupe (deterministic)', () => {
    test('Bug #355 — dedupe key is computed after load, so a re-scanned row is deduped', async ({ page }) => {
        // Rows are skeletons at first scan, load 400ms later. A one-shot goNext forces a
        // re-scan of the same (now text-changed) elements.
        await buildLazyLoadTable(page, 400);

        let pages = 0;
        const table = useTable(page.locator('#t'), {
            rowSelector: 'tbody tr.row',
            headerSelector: 'thead th',
            cellSelector: 'td',
            strategies: {
                pagination: {
                    // Return true exactly once → engine scans page 1, then re-scans page 2
                    // (same elements, now loaded → ElementTracker re-flags them as unseen).
                    goNext: async () => { pages++; return pages < 2; }
                },
                loading: {
                    isRowLoading: async (row) => (await row.locator('.skeleton').count()) > 0,
                    rowLoadingTimeout: 3000,
                    onRowLoadingTimeout: 'read-as-is'
                },
                dedupe: skeletonAwareDedupe
            }
        });

        const results = await table.map(({ row }) => row.toJSON(), { maxPages: 2 });
        const ids = results.map((r: any) => r.ID);

        // Exactly the 4 rows, once each, in order — no skeleton/loaded key split.
        expect(ids).toEqual(['1', '2', '3', '4']);
    });

    test('Bug #355 — dedupe runs on loaded content even when the first scan sees skeletons', async ({ page }) => {
        // Single scan, rows load mid-wait. Proves the dedupe key itself is content-based
        // (not a positional skeleton fallback that would poison a later re-scan).
        await buildLazyLoadTable(page, 400);

        const seenKeys: string[] = [];
        const table = useTable(page.locator('#t'), {
            rowSelector: 'tbody tr.row',
            headerSelector: 'thead th',
            cellSelector: 'td',
            strategies: {
                loading: {
                    isRowLoading: async (row) => (await row.locator('.skeleton').count()) > 0,
                    rowLoadingTimeout: 3000,
                    onRowLoadingTimeout: 'read-as-is'
                },
                dedupe: async (row) => {
                    const key = await skeletonAwareDedupe(row);
                    seenKeys.push(key);
                    return key;
                }
            }
        });

        const results = await table.map(({ row }) => row.toJSON(), { maxPages: 1 });
        expect(results.map((r: any) => r.ID)).toEqual(['1', '2', '3', '4']);
        // Every dedupe key was content-based — the wait ran first.
        expect(seenKeys.every(k => k.startsWith('id:'))).toBe(true);
    });
});

test.describe('Bug #355 — map() loading semantics on the virtualized playground', () => {
    test.beforeEach(async ({ page }) => {
        try {
            const response = await page.request.get('http://localhost:3000/virtualized');
            if (!response.ok()) throw new Error('Local server not running');
        } catch (e) {
            test.skip(true, 'Skipping: Local playground server not running at localhost:3000');
        }

        await page.goto('http://localhost:3000/virtualized');
        await expect(page.getByRole('heading', { name: 'Virtualized Table Scenario' })).toBeVisible();
    });

    test('Bug #355 — onRowLoadingTimeout: "skip" drops never-loading rows from map()', async ({ page }) => {
        test.setTimeout(30_000);

        await setPlaygroundConfig(page, {
            rowCount: 10,
            defaults: {
                tableInitDelay: 0,
                rowDelay: { base: 999999, stutter: 0 },
                generator: 'simple'
            }
        });

        await page.waitForTimeout(500);

        const table = useTable(page.locator('.virtual-table-container'), {
            ...baseTableConfig,
            strategies: {
                loading: {
                    isRowLoading: async (row) => {
                        return (await row.locator('.skeleton-row').count()) > 0;
                    },
                    rowLoadingTimeout: 300,
                    onRowLoadingTimeout: 'skip'
                }
            },
            maxPages: 1
        });

        // Cheap callback — never touches cells (skeleton rows have none).
        const results = await table.map(({ rowIndex }) => rowIndex, { maxPages: 1 });
        expect(results.length).toBe(0);
    });

    test('Bug #355 — backward compat: no rowLoadingTimeout → map() processes rows as-is', async ({ page }) => {
        test.setTimeout(30_000);

        // findRows drops loading rows when no timeout is configured (legacy skip).
        // map/forEach historically ignored isRowLoading entirely — with no timeout
        // configured they must keep processing every row, not silently drop them.
        await setPlaygroundConfig(page, {
            rowCount: 10,
            defaults: {
                tableInitDelay: 0,
                rowDelay: { base: 999999, stutter: 0 },
                generator: 'simple'
            }
        });

        await page.waitForTimeout(500);

        const table = useTable(page.locator('.virtual-table-container'), {
            ...baseTableConfig,
            strategies: {
                loading: {
                    isRowLoading: async (row) => {
                        return (await row.locator('.skeleton-row').count()) > 0;
                    }
                    // No rowLoadingTimeout
                }
            },
            maxPages: 1
        });

        const results = await table.map(({ rowIndex }) => rowIndex, { maxPages: 1 });
        expect(results.length).toBeGreaterThan(0);
    });
});
