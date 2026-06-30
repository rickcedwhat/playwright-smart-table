import { Locator } from '@playwright/test';
import { TableConfig, TableContext } from '../types';
import { PaginationStrategies } from '../strategies';
import { logDebug } from '../utils/debugUtils';

/** Aria-labels for MUI pagination buttons. Override for non-English locales. */
export interface MuiButtonLabels {
    nextPage?: string;
    previousPage?: string;
    firstPage?: string;
}

const DEFAULT_LABELS: Required<MuiButtonLabels> = {
    nextPage: 'Go to next page',
    previousPage: 'Go to previous page',
    firstPage: 'Go to first page',
};

/** 
 * Safely wait for MUI pagination to stabilize.
 * Polls for displayed row text changes and waits for loading overlays to disappear.
 */
async function waitForMuiPaginationStabilization(context: TableContext, displayedRows: Locator, oldText: string) {
    let retries = 50; // 5 second timeout for client-side render
    while (oldText && retries-- > 0 && await displayedRows.innerText().catch(() => '') === oldText) {
        await context.page.waitForTimeout(100);
    }

    // Standard MUI loading strategy check
    if (context.config.strategies.loading?.isTableLoading) {
        let loadingRetries = 30;
        while (loadingRetries-- > 0 && await context.config.strategies.loading.isTableLoading(context)) {
            await context.page.waitForTimeout(100);
        }
    }

    // DataGrid specific fallback (if not using loading strategy)
    const overlay = context.root.locator('.MuiDataGrid-overlay');
    if (await overlay.count() > 0) {
        let loadingRetries = 30;
        while (loadingRetries-- > 0 && await overlay.isVisible().catch(() => false)) {
            await context.page.waitForTimeout(100);
        }
    }
}

/** safely locate the pagination container related to our table context */
async function getPaginationRoot(context: TableContext) {
    // 1. If the user initialized useTable on the layout wrapper itself
    const inside = context.root.locator('.MuiTablePagination-root').first();
    if (await inside.count() > 0) return inside;

    // 2. If the user initialized on the Table, look up to the closest Paper wrapper
    const paper = context.root.locator('xpath=ancestor::*[contains(@class, "MuiPaper-root")][1]').first();
    if (await paper.count() > 0) {
        const inPaper = paper.locator('.MuiTablePagination-root').first();
        if (await inPaper.count() > 0) return inPaper;
    }

    // 3. Fallback: find the first pagination footer that follows this context in the DOM
    return context.root.locator('xpath=following::div[contains(@class, "MuiTablePagination-root")][1]').first();
}

/**
 * Creates a preset configuration for the standard Material UI `<Table />` component.
 *
 * @param opts.buttonLabels - Override aria-labels for pagination buttons (use for non-English locales).
 *
 * @example
 * // French locale
 * const table = useTable(loc, createMuiTable({ buttonLabels: { nextPage: 'Page suivante', previousPage: 'Page précédente' } }));
 */
export function createMuiTable(opts?: { buttonLabels?: MuiButtonLabels }): Partial<TableConfig> {
    const labels = { ...DEFAULT_LABELS, ...opts?.buttonLabels };
    return {
    rowSelector: 'tbody tr, tbody .MuiTableRow-root',
    cellSelector: 'td, th, .MuiTableCell-body',
    headerSelector: 'thead th, .MuiTableCell-head',

    headerTransformer: ({ text }) => text.replace(/\bsorted\s+(?:ascending|descending)\b/i, '').trim(),

    strategies: {
        pagination: {
            goNext: async (context) => {
                const root = await getPaginationRoot(context);
                const nextBtn = root.getByRole('button', { name: labels.nextPage, exact: true });
                if (await nextBtn.count() === 0 || await nextBtn.isDisabled()) return false;

                const displayedRows = root.locator('.MuiTablePagination-displayedRows');
                const oldText = await displayedRows.innerText().catch(() => '');

                // Force click ignores cookie banners obscuring the footer
                await nextBtn.click({ force: true });
                await waitForMuiPaginationStabilization(context, displayedRows, oldText);
                return true;
            },
            goPrevious: async (context) => {
                const root = await getPaginationRoot(context);
                const prevBtn = root.getByRole('button', { name: labels.previousPage, exact: true });
                if (await prevBtn.count() === 0 || await prevBtn.isDisabled()) return false;

                const displayedRows = root.locator('.MuiTablePagination-displayedRows');
                const oldText = await displayedRows.innerText().catch(() => '');

                await prevBtn.click({ force: true });
                await waitForMuiPaginationStabilization(context, displayedRows, oldText);
                return true;
            },
            goToFirst: async (context) => {
                const root = await getPaginationRoot(context);
                const displayedRows = root.locator('.MuiTablePagination-displayedRows');

                // MUI TablePagination optionally renders a "first page" button (showFirstButton prop)
                const firstBtn = root.getByRole('button', { name: labels.firstPage, exact: true });
                if (await firstBtn.count() > 0 && !(await firstBtn.isDisabled())) {
                    const oldText = await displayedRows.innerText().catch(() => '');
                    await firstBtn.click({ force: true });
                    await waitForMuiPaginationStabilization(context, displayedRows, oldText);
                    return true;
                }

                // Fall back to stepping backward one page at a time
                const prevBtn = root.getByRole('button', { name: labels.previousPage, exact: true });
                let clicked = false;
                let noProgressCount = 0;
                const NO_PROGRESS_LIMIT = 3;

                while (await prevBtn.count() > 0 && !(await prevBtn.isDisabled())) {
                    const oldText = await displayedRows.innerText().catch(() => '');
                    await prevBtn.click({ force: true });
                    await waitForMuiPaginationStabilization(context, displayedRows, oldText);
                    clicked = true;

                    const newText = await displayedRows.innerText().catch(() => '');
                    if (newText === oldText) {
                        noProgressCount++;
                        if (noProgressCount >= NO_PROGRESS_LIMIT) {
                            logDebug(context.config, 'error', `goToFirst: no pagination progress after ${NO_PROGRESS_LIMIT} consecutive clicks — aborting to avoid infinite loop`);
                            return false;
                        }
                    } else {
                        noProgressCount = 0;
                    }
                }
                return clicked;
            }
        },
        sorting: {
            getSortState: async ({ columnName, context }) => {
                if (!context.getHeaderCell) return 'none';
                const header = await context.getHeaderCell(columnName);
                const sortLabel = header.locator('.MuiTableSortLabel-root').first();
                if (!(await sortLabel.isVisible().catch(() => false))) return 'none';

                const className = await sortLabel.getAttribute('class') || '';
                if (className.includes('directionAsc')) return 'asc';
                if (className.includes('directionDesc')) return 'desc';

                // Often, if the label is active but lacks explicit direction classes, MUI defaults to ascending
                if (className.includes('active')) return 'asc';

                return 'none';
            },
            doSort: async ({ columnName, direction, context }) => {
                if (!context.getHeaderCell) return;
                const header = await context.getHeaderCell(columnName);
                const sortLabel = header.locator('.MuiTableSortLabel-root').first();
                const target = await sortLabel.isVisible().catch(() => false) ? sortLabel : header;

                let current = await context.config.strategies.sorting?.getSortState({ columnName, context }) || 'none';
                let attempts = 0;
                // Click until the state matches the target direction, max 3 times (none -> asc -> desc)
                while (current !== direction && attempts < 3) {
                    await target.click();
                    await context.page.waitForTimeout(100);
                    current = await context.config.strategies.sorting?.getSortState({ columnName, context }) || 'none';
                    attempts++;
                }
            }
        },
        dedupe: async (row) => {
            // MUI virtualized tables attach data-index to rows 
            const dataIndex = await row.getAttribute('data-index');
            if (dataIndex !== null) return dataIndex;

            // Unvirtualized tables don't recycle nodes, but if they do duplicate, fallback to first cell's text
            const text = await row.locator('td, th').first().innerText().catch(() => '');
            return text || String(Math.random());
        }
    }
    };
}

/** Default preset for MUI `<Table />`. For non-English locales use `createMuiTable({ buttonLabels })`. */
export const muiTable: Partial<TableConfig> = createMuiTable();

/**
 * Creates a preset configuration for the MUI DataGrid component (@mui/x-data-grid).
 *
 * @param opts.buttonLabels - Override aria-labels for pagination buttons (use for non-English locales).
 *
 * Handles:
 * - Selectors for `.MuiDataGrid-row`, `.MuiDataGrid-cell`, and `.MuiDataGrid-columnHeader`.
 * - Pagination via the `.MuiDataGrid-footerContainer` (handling React's async rendering).
 * - Sorting via `aria-sort` on column headers.
 * - Vertical Virtualization deduplication using `data-rowindex`.
 * - Horizontal Virtualization support via `aria-colindex`.
 */
export function createMuiDataGrid(opts?: { buttonLabels?: MuiButtonLabels }): Partial<TableConfig> {
    const labels = { ...DEFAULT_LABELS, ...opts?.buttonLabels };
    return {
    rowSelector: '.MuiDataGrid-row',
    cellSelector: '.MuiDataGrid-cell',
    headerSelector: '.MuiDataGrid-columnHeader',
    concurrency: 'synchronized',

    strategies: {
        pagination: {
            goNext: async (context) => {
                const footer = context.root.locator('.MuiDataGrid-footerContainer');
                const nextBtn = footer.getByRole('button', { name: labels.nextPage, exact: true });

                try {
                    await nextBtn.waitFor({ state: 'visible', timeout: 2000 });
                } catch (e) {
                    return false;
                }

                if (await nextBtn.isDisabled()) return false;

                const displayedRows = footer.locator('.MuiTablePagination-displayedRows');
                const oldText = await displayedRows.innerText().catch(() => '');

                await nextBtn.scrollIntoViewIfNeeded().catch(() => {});
                await nextBtn.click({ force: true });
                await waitForMuiPaginationStabilization(context, displayedRows, oldText);
                return true;
            },
            goPrevious: async (context) => {
                const footer = context.root.locator('.MuiDataGrid-footerContainer');
                const prevBtn = footer.getByRole('button', { name: labels.previousPage, exact: true });

                try {
                    await prevBtn.waitFor({ state: 'visible', timeout: 2000 });
                } catch (e) {
                    return false;
                }

                if (await prevBtn.isDisabled()) return false;

                const displayedRows = footer.locator('.MuiTablePagination-displayedRows');
                const oldText = await displayedRows.innerText().catch(() => '');

                await prevBtn.scrollIntoViewIfNeeded().catch(() => {});
                await prevBtn.click({ force: true });
                await waitForMuiPaginationStabilization(context, displayedRows, oldText);
                return true;
            },
            goToFirst: async (context) => {
                const footer = context.root.locator('.MuiDataGrid-footerContainer');
                const displayedRows = footer.locator('.MuiTablePagination-displayedRows');

                const firstBtn = footer.getByRole('button', { name: labels.firstPage, exact: true });
                try {
                    await firstBtn.waitFor({ state: 'visible', timeout: 1000 });
                    if (!(await firstBtn.isDisabled())) {
                        const oldText = await displayedRows.innerText().catch(() => '');
                        await firstBtn.scrollIntoViewIfNeeded().catch(() => {});
                        await firstBtn.click({ force: true });
                        await waitForMuiPaginationStabilization(context, displayedRows, oldText);
                        return true;
                    }
                } catch {
                    // first-page button not present; fall back to stepping backward
                }

                const prevBtn = footer.getByRole('button', { name: labels.previousPage, exact: true });
                let clicked = false;
                let noProgressCount = 0;
                const NO_PROGRESS_LIMIT = 3;

                while (true) {
                    try {
                        await prevBtn.waitFor({ state: 'visible', timeout: 2000 });
                    } catch {
                        break;
                    }
                    if (await prevBtn.isDisabled()) break;

                    const oldText = await displayedRows.innerText().catch(() => '');
                    await prevBtn.scrollIntoViewIfNeeded().catch(() => {});
                    await prevBtn.click({ force: true });
                    await waitForMuiPaginationStabilization(context, displayedRows, oldText);
                    clicked = true;

                    const newText = await displayedRows.innerText().catch(() => '');
                    if (newText === oldText) {
                        noProgressCount++;
                        if (noProgressCount >= NO_PROGRESS_LIMIT) {
                            logDebug(context.config, 'error', `goToFirst: no pagination progress after ${NO_PROGRESS_LIMIT} consecutive clicks — aborting to avoid infinite loop`);
                            return false;
                        }
                    } else {
                        noProgressCount = 0;
                    }
                }
                return clicked;
            }
        },
        sorting: {
            getSortState: async ({ columnName, context }) => {
                if (!context.getHeaderCell) return 'none';
                const header = await context.getHeaderCell(columnName);
                const sortAttr = await header.getAttribute('aria-sort');

                if (sortAttr === 'ascending') return 'asc';
                if (sortAttr === 'descending') return 'desc';
                return 'none';
            },
            doSort: async ({ columnName, direction, context }) => {
                if (!context.getHeaderCell) return;
                const header = await context.getHeaderCell(columnName);

                let current = await context.config.strategies.sorting?.getSortState({ columnName, context }) || 'none';
                let attempts = 0;
                while (current !== direction && attempts < 3) {
                    const clickTarget = header.locator('.MuiDataGrid-columnHeaderTitleContainer').first();
                    if (await clickTarget.isVisible()) {
                        await clickTarget.click({ force: true });
                    } else {
                        await header.click({ force: true });
                    }
                    
                    // Wait for stabilization (using DataGrid specific overlay check inside helper)
                    const displayedRows = context.root.locator('.MuiTablePagination-displayedRows');
                    const text = await displayedRows.innerText().catch(() => '');
                    await waitForMuiPaginationStabilization(context, displayedRows, text);

                    current = await context.config.strategies.sorting?.getSortState({ columnName, context }) || 'none';
                    attempts++;
                }
            }
        },
        dedupe: async (row) => {
            // DataGrid uses data-rowindex for its own virtualization management
            return (await row.getAttribute('data-rowindex').catch(() => null)) ?? '';
        },
        getCellLocator: ({ row, root, columnIndex, rowIndex }) => {
            // Use data-rowindex for a stable row reference: nth-based locators break after
            // vertical eviction because the DOM order shifts when rows are removed/added.
            const stableRow = typeof rowIndex === 'number'
                ? root.locator(`[data-rowindex="${rowIndex}"]`)
                : row;
            return stableRow.locator(`[aria-colindex="${columnIndex + 1}"]`);
        },
        // MUI DataGrid virtualizes rows vertically (always) and columns horizontally (when
        // columnBuffer is configured). The virtualScroller is a descendant of root, so
        // scroll methods use querySelector rather than closest().
        viewport: {
            getVisibleRowRange: async ({ root, config }) => {
                const rowSel = config.rowSelector;
                return root.evaluate((el, rowSel) => {
                    const indices = Array.from(el.querySelectorAll(rowSel))
                        .map(r => Number(r.getAttribute('data-rowindex')))
                        .filter(n => !isNaN(n));
                    if (!indices.length) return { first: 0, last: 0 };
                    return { first: Math.min(...indices), last: Math.max(...indices) };
                }, rowSel);
            },
            getVisibleColumnRange: async ({ root, config }) => {
                const rowSel = config.rowSelector;
                const cellSel = typeof config.cellSelector === 'string' ? config.cellSelector : '[aria-colindex]';
                return root.evaluate((el, { rowSel, cellSel }) => {
                    const scroller = el.querySelector('.MuiDataGrid-virtualScroller') as HTMLElement | null;
                    const allRows = Array.from(el.querySelectorAll(rowSel));
                    if (!allRows.length) return { first: 0, last: 0 };
                    // Use a row that's fully within the scroller's viewport bounds.
                    // The first DOM row is often an overscan row with extra columns rendered
                    // outside the clip boundary, causing the range to appear wider than it is.
                    let targetRow = allRows[0];
                    if (scroller) {
                        const scrollerRect = scroller.getBoundingClientRect();
                        const inView = allRows.find(r => {
                            const rect = (r as HTMLElement).getBoundingClientRect();
                            return rect.height > 0 &&
                                rect.top >= scrollerRect.top &&
                                rect.bottom <= scrollerRect.bottom;
                        });
                        if (inView) targetRow = inView;
                    }
                    const indices = Array.from(targetRow.querySelectorAll(cellSel))
                        .map(c => Number(c.getAttribute('aria-colindex')) - 1)
                        .filter(n => !isNaN(n) && n >= 0);
                    if (!indices.length) return { first: 0, last: 0 };
                    return { first: Math.min(...indices), last: Math.max(...indices) };
                }, { rowSel, cellSel });
            },
            scrollToRow: async ({ root, config }, rowIndex) => {
                const rowSel = config.rowSelector;
                await root.evaluate((el, { rowSel, idx }) => {
                    const scroller = el.querySelector('.MuiDataGrid-virtualScroller') as HTMLElement;
                    if (!scroller) return;
                    const existingRow = el.querySelector(`${rowSel}[data-rowindex="${idx}"]`) as HTMLElement | null;
                    if (existingRow) {
                        // Row is in DOM — adjust scrollTop only, never scrollLeft.
                        const scrollerRect = scroller.getBoundingClientRect();
                        const rowRect = existingRow.getBoundingClientRect();
                        if (rowRect.top < scrollerRect.top) {
                            scroller.scrollTop -= (scrollerRect.top - rowRect.top) + 4;
                        } else if (rowRect.bottom > scrollerRect.bottom) {
                            scroller.scrollTop += (rowRect.bottom - scrollerRect.bottom) + 4;
                        }
                        return;
                    }
                    // Row not in DOM — interpolate from visible rows' style.top positions.
                    // This is far more accurate than estimating from row heights because MUI
                    // DataGrid uses absolute positioning (style.top) for each virtual row.
                    const visibleRows = Array.from(el.querySelectorAll(rowSel)) as HTMLElement[];
                    const rowsWithPos = visibleRows
                        .map(r => {
                            const ridx = Number(r.getAttribute('data-rowindex'));
                            const top = parseFloat(r.style.top);
                            return { ridx, top };
                        })
                        .filter(r => !isNaN(r.ridx) && !isNaN(r.top) && r.top >= 0)
                        .sort((a, b) => a.ridx - b.ridx);
                    if (rowsWithPos.length >= 2) {
                        const first = rowsWithPos[0];
                        const last = rowsWithPos[rowsWithPos.length - 1];
                        const rowHeight = (last.top - first.top) / (last.ridx - first.ridx);
                        const targetTop = first.top + (idx - first.ridx) * rowHeight;
                        scroller.scrollTop = Math.max(0, targetTop - 20);
                        return;
                    }
                    // Fallback: use bounding-rect heights.
                    const heights = visibleRows
                        .map(r => r.getBoundingClientRect().height)
                        .filter(h => h > 0);
                    const estimatedHeight = heights.length
                        ? heights.reduce((s, h) => s + h, 0) / heights.length
                        : 52;
                    scroller.scrollTop = Math.max(0, idx * estimatedHeight - 20);
                }, { rowSel, idx: rowIndex });
                // Swallow timeout: the row may still be readable if it re-enters the
                // virtual viewport. targetReached() in the caller is the authoritative check.
                await root.locator(`${rowSel}[data-rowindex="${rowIndex}"]`)
                    .waitFor({ state: 'attached', timeout: 3000 })
                    .catch(() => {});
            },
            scrollToColumn: async ({ root, config, page }, colIndex) => {
                const headerSel = typeof config.headerSelector === 'string' ? config.headerSelector : null;
                await root.evaluate((el, { headerSel, idx }) => {
                    const scroller = el.querySelector('.MuiDataGrid-virtualScroller') as HTMLElement;
                    if (!scroller || !headerSel) return;
                    const headers = Array.from(el.querySelectorAll(headerSel)) as HTMLElement[];
                    const targetAriaIdx = idx + 1; // aria-colindex is 1-based

                    // Find header by aria-colindex, NOT by DOM position. With column
                    // virtualization, DOM order does not match colIndex — only headers in
                    // the current virtual window are rendered, so headers[idx] would be wrong.
                    const target = headers.find(h => Number(h.getAttribute('aria-colindex')) === targetAriaIdx);

                    if (!target) {
                        // Header not in DOM (column virtualized away). Interpolate scrollLeft
                        // from the positions of currently visible headers.
                        const visibleHeaders = headers
                            .map(h => ({ colIdx: Number(h.getAttribute('aria-colindex')), rect: h.getBoundingClientRect() }))
                            .filter(h => !isNaN(h.colIdx) && h.rect.width > 0)
                            .sort((a, b) => a.colIdx - b.colIdx);

                        if (visibleHeaders.length >= 2) {
                            const first = visibleHeaders[0];
                            const last = visibleHeaders[visibleHeaders.length - 1];
                            const pxPerCol = (last.rect.left - first.rect.left) / (last.colIdx - first.colIdx);
                            const sRect = scroller.getBoundingClientRect();
                            const firstAbsLeft = first.rect.left - sRect.left + scroller.scrollLeft;
                            scroller.scrollLeft = Math.max(0, firstAbsLeft + (targetAriaIdx - first.colIdx) * pxPerCol - 20);
                        } else if (visibleHeaders.length === 1) {
                            const h = visibleHeaders[0];
                            scroller.scrollLeft = Math.max(0, scroller.scrollLeft + (targetAriaIdx - h.colIdx) * h.rect.width - 20);
                        }
                        return;
                    }

                    const cRect = scroller.getBoundingClientRect();
                    const tRect = target.getBoundingClientRect();
                    if (tRect.left < cRect.left) {
                        scroller.scrollLeft -= (cRect.left - tRect.left) + 20;
                    } else if (tRect.right > cRect.right) {
                        scroller.scrollLeft += (tRect.right - cRect.right) + 20;
                    }
                }, { headerSel, idx: colIndex });
                // Wait for any cell with this colIndex to appear. With column virtualization
                // (32 cols), MUI DataGrid updates the DOM on requestAnimationFrame after a
                // scrollLeft change — so we may need to wait a tick. If it doesn't appear,
                // fall back to a brief pause; targetReached() is the authoritative gate.
                const appeared = await root.locator(`[aria-colindex="${colIndex + 1}"]`)
                    .first()
                    .waitFor({ state: 'attached', timeout: 2000 })
                    .then(() => true)
                    .catch(() => false);
                if (!appeared) {
                    await page.waitForTimeout(300);
                }
            },
        },
        loading: {
            isTableLoading: async (context) => {
                return await context.root.locator('.MuiDataGrid-overlay').isVisible().catch(() => false);
            }
        }
    }
    };
}

/** Default preset for MUI DataGrid. For non-English locales use `createMuiDataGrid({ buttonLabels })`. */
export const muiDataGrid: Partial<TableConfig> = createMuiDataGrid();
