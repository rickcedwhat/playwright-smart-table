import { ViewportStrategy } from '../../types';

export interface GlideViewportOptions {
    /**
     * Total column count. Used to compute the horizontal scroll ratio when the
     * target column is not yet mounted. Default: 64.
     */
    columnCount?: number;
    /**
     * Row height in pixels, used to estimate scrollTop when the target row is not
     * yet mounted. Matches Glide's default row height. Default: 34.
     */
    rowHeight?: number;
    /**
     * Milliseconds to wait for a cell/row to appear in the DOM after a scroll.
     * Default: 3000.
     */
    attachTimeout?: number;
}

/**
 * Viewport strategy for Glide Data Grid.
 *
 * Glide renders an ARIA accessibility table (`table[role="grid"]`) alongside its
 * canvas. Rows and cells are virtualized: only the currently visible window of
 * `tbody tr` / `td[aria-colindex]` elements exists in the DOM at any moment.
 *
 * This strategy:
 * - `getVisibleColumnRange` — reads `aria-colindex` values from the first visible row
 * - `getVisibleRowRange`   — reads `aria-rowindex` values from visible rows (2-based: header = 1)
 * - `scrollToColumn`       — sets `.dvn-scroller.scrollLeft` via ratio, waits for cell mount
 * - `scrollToRow`          — sets `.dvn-scroller.scrollTop` via rowHeight estimate, waits for row mount
 */
export const createGlideViewport = (options: GlideViewportOptions = {}): ViewportStrategy => {
    const columnCount = options.columnCount ?? 64;
    const rowHeight = options.rowHeight ?? 34;
    const attachTimeout = options.attachTimeout ?? 3000;

    return {
        getVisibleColumnRange: async ({ page }) => {
            const indices = await page
                .locator('table[role="grid"] tbody tr')
                .first()
                .locator('td[aria-colindex]')
                .evaluateAll((tds) =>
                    (tds as HTMLElement[]).map(
                        (td) => parseInt(td.getAttribute('aria-colindex') || '1') - 1
                    )
                );
            if (!indices.length) return { first: 0, last: 0 };
            return { first: Math.min(...indices), last: Math.max(...indices) };
        },

        getVisibleRowRange: async ({ page }) => {
            // aria-rowindex is 1-based; header row = 1, so data row 0 → aria-rowindex="2"
            const indices = await page
                .locator('table[role="grid"] tbody tr[aria-rowindex]')
                .evaluateAll((trs) =>
                    (trs as HTMLElement[]).map(
                        (tr) => parseInt(tr.getAttribute('aria-rowindex') || '2') - 2
                    )
                );
            if (!indices.length) return { first: 0, last: 0 };
            return { first: Math.min(...indices), last: Math.max(...indices) };
        },

        scrollToColumn: async ({ page }, colIndex) => {
            const scroller = page.locator('.dvn-scroller').first();
            await scroller.evaluate(
                (el, { idx, count }: { idx: number; count: number }) => {
                    const max = Math.max(0, el.scrollWidth - el.clientWidth);
                    const ratio = Math.min(1, Math.max(0, (idx + 0.5) / count));
                    el.scrollLeft = Math.floor(ratio * max);
                },
                { idx: colIndex, count: columnCount }
            );
            // Wait for Glide to mount the target td in its virtual accessibility window
            await page
                .locator(`table[role="grid"] tbody tr td[aria-colindex="${colIndex + 1}"]`)
                .first()
                .waitFor({ state: 'attached', timeout: attachTimeout });
        },

        scrollToRow: async ({ page }, rowIndex) => {
            const scroller = page.locator('.dvn-scroller').first();
            // aria-rowindex is 2-based for data rows (header = 1)
            const ariaRowIndex = rowIndex + 2;
            const rowSel = `table[role="grid"] tbody tr[aria-rowindex="${ariaRowIndex}"]`;

            // If the row is already mounted, scroll it into view; otherwise estimate via rowHeight
            const isAttached = await page.locator(rowSel).count() > 0;
            if (isAttached) {
                await page.locator(rowSel).first().scrollIntoViewIfNeeded();
            } else {
                await scroller.evaluate(
                    (el, { idx, height }: { idx: number; height: number }) => {
                        const targetTop = idx * height;
                        el.scrollTop = Math.max(0, targetTop - Math.floor(el.clientHeight / 2));
                    },
                    { idx: rowIndex, height: rowHeight }
                );
                await page
                    .locator(rowSel)
                    .waitFor({ state: 'attached', timeout: attachTimeout });
            }
        },
    };
};
