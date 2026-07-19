import { test, expect } from '@playwright/test';
import { useTable, Strategies } from '../src';
import type { ViewportStrategy } from '../src/types';

/**
 * A2 (#353 part 2 / #357): map/forEach/filter should collect only rows within the scroll
 * container's visible bounds when the viewport reports them (getVisibleRowIndices), not the
 * overscan rows the virtual scroller keeps mounted above/below the fold.
 *
 * Fixture: a 100px scroll container with 15 rows (20px each) absolutely positioned; rows 0–4
 * overlap the viewport, rows 5–14 are mounted but entirely below the fold. Nothing is evicted,
 * so "all mounted" = 15 while "visible" = 5.
 */
function makeVirtHtml(rowCount: number) {
    const rows = Array.from({ length: rowCount }, (_, i) =>
        `<div class="row" data-index="${i}" style="position:absolute; top:${i * 20}px; height:20px; width:100%;">
            <span class="cell">v${i}</span>
        </div>`
    ).join('');
    return `<!DOCTYPE html><html><body>
        <div id="scroller" style="height:100px; overflow:auto; position:relative; border:1px solid #ccc;">
            <div id="grid" style="position:relative; height:${rowCount * 20}px;">
                <div class="hdr" style="position:sticky; top:0; height:0; overflow:visible;">
                    <span class="col">Val</span>
                </div>
                ${rows}
            </div>
        </div>
    </body></html>`;
}

const viewport: ViewportStrategy = Strategies.Viewport.dataAttribute({
    scrollContainer: '#scroller',
    rowAttribute: 'data-index',
});

const baseConfig = {
    rowSelector: '.row',
    headerSelector: '.hdr .col',
    cellSelector: '.cell',
};

test.describe('A2 — visible-row iteration filtering (#353 part 2 / #357)', () => {
    test('getVisibleRowIndices returns DOM positions of only the visible rows', async ({ page }) => {
        await page.setContent(makeVirtHtml(15));
        await page.waitForTimeout(50);

        if (!viewport.getVisibleRowIndices) throw new Error('getVisibleRowIndices not implemented');
        const visible = await viewport.getVisibleRowIndices({
            root: page.locator('#grid'),
            config: baseConfig,
        } as any);

        // 15 rows mounted; only rows 0–4 overlap the 100px container.
        expect(visible[0]).toBe(0);
        expect(visible[visible.length - 1]).toBeLessThan(14); // overscan excluded
        expect(visible.length).toBeLessThanOrEqual(6);
        expect(visible.length).toBeGreaterThanOrEqual(4);
    });

    test('map collects only visible rows, not overscan (default-on with a viewport)', async ({ page }) => {
        await page.setContent(makeVirtHtml(15));
        await page.waitForTimeout(50);

        const table = await useTable(page.locator('#grid'), {
            ...baseConfig,
            strategies: { viewport },
        }).init();

        const values = await table.map(({ row }) => row.getAttribute('data-index'), { maxPages: 1 });
        // Without A2 this would be all 15 mounted rows; with A2, only the visible top window.
        // (Exact boundary row is pixel-sensitive, so assert the shape: a contiguous prefix
        // from 0, deep overscan excluded, far fewer than 15.)
        expect(values).toEqual(values.map((_, i) => String(i))); // contiguous 0,1,2,…
        expect(values).toContain('0');
        expect(values).toContain('4');
        expect(values).not.toContain('10');
        expect(values).not.toContain('14');
        expect(values.length).toBeLessThanOrEqual(7);
    });

    test('without a viewport, map still collects every mounted row (unchanged)', async ({ page }) => {
        await page.setContent(makeVirtHtml(15));
        await page.waitForTimeout(50);

        const table = await useTable(page.locator('#grid'), baseConfig).init();
        const values = await table.map(({ row }) => row.getAttribute('data-index'), { maxPages: 1 });
        expect(values).toHaveLength(15);
    });

    test('forEach also honors the visible filter', async ({ page }) => {
        await page.setContent(makeVirtHtml(15));
        await page.waitForTimeout(50);

        const table = await useTable(page.locator('#grid'), {
            ...baseConfig,
            strategies: { viewport },
        }).init();

        const seen: (string | null)[] = [];
        await table.forEach(async ({ row }) => { seen.push(await row.getAttribute('data-index')); }, { maxPages: 1 });
        expect(seen).toEqual(seen.map((_, i) => String(i))); // contiguous visible prefix
        expect(seen).toContain('0');
        expect(seen).not.toContain('14');
        expect(seen.length).toBeLessThanOrEqual(7);
    });
});
