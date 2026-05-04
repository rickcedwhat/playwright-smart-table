import { Locator } from '@playwright/test';
import { TableConfig, TableContext } from '../types';
import { PaginationStrategies } from '../strategies';
import { logDebug } from '../utils/debugUtils';

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
 * Preset configuration for the standard Material UI `<Table />` component.
 * 
 * Handles:
 * - Selectors for `.MuiTableRow-root`, `.MuiTableCell-head`, etc.
 * - Pagination via the standard `.MuiTablePagination-actions` footer.
 * - Sorting via the `.MuiTableSortLabel-root` header classes.
 * - Virtualized DOM deduplication (falls back to cell text if unvirtualized).
 */
export const muiTable: Partial<TableConfig> = {
    rowSelector: 'tbody tr, tbody .MuiTableRow-root',
    cellSelector: 'td, th, .MuiTableCell-body',
    headerSelector: 'thead th, .MuiTableCell-head',

    headerTransformer: ({ text }) => text.replace(/\bsorted\s+(?:ascending|descending)\b/i, '').trim(),

    strategies: {
        pagination: {
            goNext: async (context) => {
                const root = await getPaginationRoot(context);
                const nextBtn = root.locator('button[aria-label="Go to next page"]');
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
                const prevBtn = root.locator('button[aria-label="Go to previous page"]');
                if (await prevBtn.count() === 0 || await prevBtn.isDisabled()) return false;

                const displayedRows = root.locator('.MuiTablePagination-displayedRows');
                const oldText = await displayedRows.innerText().catch(() => '');

                await prevBtn.click({ force: true });
                await waitForMuiPaginationStabilization(context, displayedRows, oldText);
                return true;
            },
            goToFirst: async (context) => {
                const root = await getPaginationRoot(context);
                const prevBtn = root.locator('button[aria-label="Go to previous page"]');
                const displayedRows = root.locator('.MuiTablePagination-displayedRows');

                let clicked = false;
                let noProgressCount = 0;
                const NO_PROGRESS_LIMIT = 3;

                while (await prevBtn.count() > 0 && !(await prevBtn.isDisabled())) {
                    const oldText = await displayedRows.innerText().catch(() => '');
                    await prevBtn.click();
                    await waitForMuiPaginationStabilization(context, displayedRows, oldText);
                    clicked = true;

                    const newText = await displayedRows.innerText().catch(() => '');
                    if (newText === oldText) {
                        noProgressCount++;
                        if (noProgressCount >= NO_PROGRESS_LIMIT) {
                            logDebug(context.config, 'error', `goToFirst: no pagination progress after ${NO_PROGRESS_LIMIT} consecutive clicks — aborting to avoid infinite loop`);
                            break;
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

/**
 * Preset configuration for the MUI DataGrid component (@mui/x-data-grid).
 * 
 * Handles:
 * - Selectors for `.MuiDataGrid-row`, `.MuiDataGrid-cell`, and `.MuiDataGrid-columnHeader`.
 * - Pagination via the `.MuiDataGrid-footerContainer` (handling React's async rendering).
 * - Sorting via `aria-sort` on column headers.
 * - Vertical Virtualization deduplication using `data-rowindex`.
 * - Horizontal Virtualization support via `aria-colindex`.
 */
export const muiDataGrid: Partial<TableConfig> = {
    rowSelector: '.MuiDataGrid-row',
    cellSelector: '.MuiDataGrid-cell',
    headerSelector: '.MuiDataGrid-columnHeader',

    strategies: {
        pagination: {
            goNext: async (context) => {
                const footer = context.root.locator('.MuiDataGrid-footerContainer');
                const nextBtn = footer.locator('button[aria-label="Go to next page"]');
                
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
                const prevBtn = footer.locator('button[aria-label="Go to previous page"]');
                
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
                    
                    // Sorting can trigger large re-renders/virtualization shifts
                    await context.page.waitForTimeout(500); 
                    
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
        getCellLocator: ({ row, columnIndex }) => {
            // Horizontal virtualization uses aria-colindex (1-indexed)
            return row.locator(`[aria-colindex="${columnIndex + 1}"]`);
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
                    const firstRow = el.querySelector(rowSel);
                    if (!firstRow) return { first: 0, last: 0 };
                    const indices = Array.from(firstRow.querySelectorAll(cellSel))
                        .map(c => Number(c.getAttribute('aria-colindex')) - 1)
                        .filter(n => !isNaN(n));
                    if (!indices.length) return { first: 0, last: 0 };
                    return { first: Math.min(...indices), last: Math.max(...indices) };
                }, { rowSel, cellSel });
            },
            scrollToRow: async ({ root, config }, rowIndex) => {
                const rowSel = config.rowSelector;
                await root.evaluate((el, { rowSel, idx }) => {
                    const scroller = el.querySelector('.MuiDataGrid-virtualScroller') as HTMLElement;
                    if (!scroller) return;
                    const row = el.querySelector(`${rowSel}[data-rowindex="${idx}"]`);
                    if (row) {
                        row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                        return;
                    }
                    const visibleRows = Array.from(el.querySelectorAll(rowSel)) as HTMLElement[];
                    const heights = visibleRows
                        .map(visibleRow => visibleRow.getBoundingClientRect().height)
                        .filter(height => height > 0);
                    const estimatedHeight = heights.length
                        ? heights.reduce((sum, height) => sum + height, 0) / heights.length
                        : 52;
                    scroller.scrollTop = Math.max(0, idx * estimatedHeight - 20);
                }, { rowSel, idx: rowIndex });
                await root.locator(`${rowSel}[data-rowindex="${rowIndex}"]`)
                    .waitFor({ state: 'attached', timeout: 3000 });
            },
            scrollToColumn: async ({ root, config }, colIndex) => {
                const headerSel = typeof config.headerSelector === 'string' ? config.headerSelector : null;
                await root.evaluate((el, { headerSel, idx }) => {
                    // virtualScroller is a descendant — querySelector, not closest
                    const scroller = el.querySelector('.MuiDataGrid-virtualScroller') as HTMLElement;
                    if (!scroller || !headerSel) return;
                    const headers = Array.from(el.querySelectorAll(headerSel));
                    const target = headers[idx] as HTMLElement | undefined;
                    if (!target) {
                        const widths = headers
                            .map(header => (header as HTMLElement).getBoundingClientRect().width)
                            .filter(width => width > 0);
                        const estimatedWidth = widths.length
                            ? widths.reduce((sum, width) => sum + width, 0) / widths.length
                            : 100;
                        scroller.scrollLeft = Math.max(0, idx * estimatedWidth - 20);
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
                await root.locator(`${config.rowSelector} [aria-colindex="${colIndex + 1}"]`)
                    .first()
                    .waitFor({ state: 'attached', timeout: 3000 });
            },
        },
        loading: {
            isTableLoading: async (context) => {
                return await context.root.locator('.MuiDataGrid-overlay').isVisible().catch(() => false);
            }
        }
    }
};
