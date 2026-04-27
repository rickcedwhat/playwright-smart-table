import { ViewportStrategy } from '../types';

export type DataAttributeViewportOptions = {
    /**
     * CSS selector for the scroll container (the element with overflow: auto/scroll).
     * Resolved with `closest()` from the root element, so ancestors are found automatically.
     * Defaults to 'div[class*="overflow-auto"]'.
     */
    scrollContainer?: string;
    /**
     * Milliseconds to wait for cells to appear in the DOM after a column scroll.
     * Defaults to 3000.
     */
    attachTimeout?: number;
    /**
     * DOM attribute on row elements that holds the row index.
     * Defaults to 'data-index'. Use 'aria-rowindex' for ARIA grids.
     */
    rowAttribute?: string;
    /**
     * DOM attribute on cell elements that holds the column index.
     * Defaults to 'data-index'. Use 'aria-colindex' for ARIA grids.
     */
    columnAttribute?: string;
    /**
     * Estimated row height used when the target virtualized row is not mounted.
     * If omitted, the strategy infers it from visible rows and falls back to 40px.
     */
    rowHeight?: number;
    /**
     * Estimated column width used when the target virtualized header is not mounted.
     * If omitted, the strategy infers it from visible headers/cells and falls back to 120px.
     */
    columnWidth?: number;
    /**
     * Pixel padding applied when jumping to an estimated row or column position.
     * Defaults to 20.
     */
    scrollPadding?: number;
    /**
     * Value subtracted from the attribute to get the 0-based row index.
     * Defaults to 0. Use 1 for 'aria-rowindex' which is 1-based.
     */
    rowOffset?: number;
    /**
     * Value subtracted from the attribute to get the 0-based column index.
     * Defaults to 0. Use 1 for 'aria-colindex' which is 1-based.
     */
    columnOffset?: number;
};

/**
 * Viewport strategies for tables where row and cell elements carry a DOM attribute
 * equal to their index (e.g. Braintrust logs table, TanStack-style grids).
 *
 * Derives selectors from the table config so no duplication is needed:
 *   - getVisibleColumnRange — reads column attribute from cells in the first visible row
 *   - getVisibleRowRange   — reads row attribute from all visible row elements
 *   - scrollToColumn       — aligns header's left edge to container left, waits for cell mount
 *   - scrollToRow          — scrolls row into view, waits for row mount
 *
 * @example
 * // TanStack / Braintrust (data-index, 0-based — default)
 * viewport: Strategies.Viewport.dataAttribute()
 *
 * @example
 * // ARIA grid (aria-rowindex / aria-colindex, 1-based)
 * viewport: Strategies.Viewport.dataAttribute({ rowAttribute: 'aria-rowindex', columnAttribute: 'aria-colindex', rowOffset: 1, columnOffset: 1 })
 */
const dataAttribute = (options?: DataAttributeViewportOptions): ViewportStrategy => {
    const containerSel = options?.scrollContainer ?? 'div[class*="overflow-auto"]';
    const attachTimeout = options?.attachTimeout ?? 3000;
    const rowAttr = options?.rowAttribute ?? 'data-index';
    const colAttr = options?.columnAttribute ?? 'data-index';
    const rowOffset = options?.rowOffset ?? 0;
    const colOffset = options?.columnOffset ?? 0;
    const rowHeight = options?.rowHeight;
    const columnWidth = options?.columnWidth;
    const scrollPadding = options?.scrollPadding ?? 20;

    return {
        getVisibleColumnRange: async ({ root, config }) => {
            const rowSel = config.rowSelector;
            const cellSel = typeof config.cellSelector === 'string' ? config.cellSelector : `[${colAttr}]`;
            return root.evaluate((el, { rowSel, cellSel, colAttr, colOffset }) => {
                const firstRow = el.querySelector(rowSel);
                if (!firstRow) return { first: 0, last: 0 };
                const indices = Array.from(firstRow.querySelectorAll(cellSel))
                    .map(c => Number(c.getAttribute(colAttr)) - colOffset)
                    .filter(n => !isNaN(n));
                if (!indices.length) return { first: 0, last: 0 };
                return { first: Math.min(...indices), last: Math.max(...indices) };
            }, { rowSel, cellSel, colAttr, colOffset });
        },

        getVisibleRowRange: async ({ root, config }) => {
            const rowSel = config.rowSelector;
            return root.evaluate((el, { rowSel, rowAttr, rowOffset }) => {
                const indices = Array.from(el.querySelectorAll(rowSel))
                    .map(r => Number(r.getAttribute(rowAttr)) - rowOffset)
                    .filter(n => !isNaN(n));
                if (!indices.length) return { first: 0, last: 0 };
                return { first: Math.min(...indices), last: Math.max(...indices) };
            }, { rowSel, rowAttr, rowOffset });
        },

        scrollToColumn: async ({ root, config }, colIndex) => {
            const headerSel = typeof config.headerSelector === 'string' ? config.headerSelector : null;
            const cellSel = typeof config.cellSelector === 'string' ? config.cellSelector : `[${colAttr}]`;
            await root.evaluate((el, { containerSel, headerSel, cellSel, idx, columnWidth, scrollPadding }) => {
                const container = el.closest(containerSel) as HTMLElement;
                if (!container || !headerSel) return;
                const headers = Array.from(el.querySelectorAll(headerSel));
                const target = headers[idx] as HTMLElement | undefined;
                if (!target) {
                    const widthSources = headers.length ? headers : Array.from(el.querySelectorAll(cellSel));
                    const widths = widthSources
                        .map(node => (node as HTMLElement).getBoundingClientRect().width)
                        .filter(width => width > 0);
                    const estimatedWidth = columnWidth ?? (widths.length
                        ? widths.reduce((sum, width) => sum + width, 0) / widths.length
                        : 120);
                    container.scrollLeft = Math.max(0, idx * estimatedWidth - scrollPadding);
                    return;
                }
                const cRect = container.getBoundingClientRect();
                const tRect = target.getBoundingClientRect();
                if (tRect.left < cRect.left) {
                    // Scrolling left: align target's right edge to container's right
                    container.scrollLeft -= (cRect.right - tRect.right) - scrollPadding;
                } else if (tRect.right > cRect.right) {
                    // Scrolling right: align target's left edge to container's left
                    // so the maximum number of subsequent columns are already in view
                    container.scrollLeft += (tRect.left - cRect.left) - scrollPadding;
                }
            }, { containerSel, headerSel, cellSel, idx: colIndex, columnWidth, scrollPadding });

            // Wait for a cell at this column index to mount in any row
            await root
                .locator(`${config.rowSelector} [${colAttr}="${colIndex + colOffset}"]`)
                .first()
                .waitFor({ state: 'attached', timeout: attachTimeout });
        },

        scrollToRow: async ({ root, config }, rowIndex) => {
            const rowSel = config.rowSelector;
            await root.evaluate((el, { containerSel, rowSel, rowAttr, idx, rowOffset, rowHeight, scrollPadding }) => {
                const container = el.closest(containerSel) as HTMLElement;
                if (!container) return;
                const row = container.querySelector(`${rowSel}[${rowAttr}="${idx + rowOffset}"]`);
                if (row) {
                    row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                    return;
                }
                const visibleRows = Array.from(container.querySelectorAll(rowSel)) as HTMLElement[];
                const heights = visibleRows
                    .map(visibleRow => visibleRow.getBoundingClientRect().height)
                    .filter(height => height > 0);
                const estimatedHeight = rowHeight ?? (heights.length
                    ? heights.reduce((sum, height) => sum + height, 0) / heights.length
                    : 40);
                container.scrollTop = Math.max(0, idx * estimatedHeight - scrollPadding);
            }, { containerSel, rowSel, rowAttr, idx: rowIndex, rowOffset, rowHeight, scrollPadding });

            await root
                .locator(`${rowSel}[${rowAttr}="${rowIndex + rowOffset}"]`)
                .waitFor({ state: 'attached', timeout: attachTimeout });
        },
    };
};

export const ViewportStrategies = { dataAttribute };
