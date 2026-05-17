import { ViewportStrategy } from '../../types';

export interface GlideViewportOptions {
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
 * - `scrollToColumn`       — sets `.dvn-scroller.scrollLeft` via ratio derived from header count, waits for cell mount
 * - `scrollToRow`          — sets `.dvn-scroller.scrollTop` via measured row height, waits for row mount
 */
const sanitize = (value: number | undefined, fallback: number): number => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const createGlideViewport = (options: GlideViewportOptions = {}): ViewportStrategy => {
    const attachTimeout = sanitize(options.attachTimeout, 3000);

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

        scrollToColumn: async (context, colIndex) => {
            const { page } = context;
            const scroller = page.locator('.dvn-scroller').first();

            // Derive total column count from the initialized header map (available post-init).
            // Falls back to a ratio seek only by position if headers are unavailable.
            const headers = await context.getHeaders?.();
            const totalColumns = headers?.length ?? 0;

            if (totalColumns > 0) {
                await scroller.evaluate(
                    (el, { idx, count }: { idx: number; count: number }) => {
                        const max = Math.max(0, el.scrollWidth - el.clientWidth);
                        const ratio = Math.min(1, Math.max(0, (idx + 0.5) / count));
                        el.scrollLeft = Math.floor(ratio * max);
                    },
                    { idx: colIndex, count: totalColumns }
                );
            }

            const target = page
                .locator(`table[role="grid"] tbody tr td[aria-colindex="${colIndex + 1}"]`)
                .first();

            // Wait for the cell to attach. The first probe is short (800ms fast path); after
            // any nudge the probe uses the full remaining budget so Glide has time to re-render.
            // Total ceiling = 800ms + attachTimeout, matching the original two-phase behaviour.
            const deadline = Date.now() + 800 + attachTimeout;
            let nudged = false;
            while (true) {
                const remaining = deadline - Date.now();
                if (remaining <= 0) throw Object.assign(
                    new Error(`Timed out after ${attachTimeout}ms waiting for aria-colindex="${colIndex + 1}" to attach`),
                    { name: 'TimeoutError' }
                );
                try {
                    await target.waitFor({ state: 'attached', timeout: nudged ? remaining : Math.min(800, remaining) });
                    break;
                } catch (err) {
                    if (!(err instanceof Error) || err.name !== 'TimeoutError') throw err;
                    await scroller.evaluate((el) => {
                        el.scrollLeft = Math.min(el.scrollLeft + el.clientWidth, el.scrollWidth);
                    });
                    nudged = true;
                }
            }
        },

        scrollToRow: async ({ page }, rowIndex) => {
            const scroller = page.locator('.dvn-scroller').first();
            // aria-rowindex is 2-based for data rows (header = 1)
            const ariaRowIndex = rowIndex + 2;
            const rowSel = `table[role="grid"] tbody tr[aria-rowindex="${ariaRowIndex}"]`;

            // If the row is already mounted, scroll it into view directly.
            const isAttached = await page.locator(rowSel).count() > 0;
            if (isAttached) {
                await page.locator(rowSel).first().scrollIntoViewIfNeeded();
            } else {
                // Measure actual row height from the DOM; fall back to Glide's default (34px).
                const rowHeight = await page
                    .locator('table[role="grid"] tbody tr')
                    .first()
                    .evaluate((el) => (el as HTMLElement).getBoundingClientRect().height)
                    .catch(() => 34);
                const height = rowHeight > 0 ? rowHeight : 34;

                await scroller.evaluate(
                    (el, { idx, height: h }: { idx: number; height: number }) => {
                        const targetTop = idx * h;
                        el.scrollTop = Math.max(0, targetTop - Math.floor(el.clientHeight / 2));
                    },
                    { idx: rowIndex, height }
                );
                await page
                    .locator(rowSel)
                    .waitFor({ state: 'attached', timeout: attachTimeout });
            }
        },
    };
};
