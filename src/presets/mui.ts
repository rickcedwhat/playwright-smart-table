import { TableConfig, TableContext } from '../types';
import { PaginationStrategies } from '../strategies';

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

    headerTransformer: ({ text }) => text.replace(/\s*sorted\s+(a|de)scending/i, '').trim(),

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

                let retries = 30; // 3 second timeout for client-side render
                while (oldText && retries-- > 0 && await displayedRows.innerText().catch(() => '') === oldText) {
                    await context.page.waitForTimeout(100);
                }
                
                // Extra stabilization: wait for any loading overlays to disappear
                if (context.config.strategies.loading?.isTableLoading) {
                    let loadingRetries = 20;
                    while (loadingRetries-- > 0 && await context.config.strategies.loading.isTableLoading(context)) {
                        await context.page.waitForTimeout(100);
                    }
                }
                return true;
            },
            goPrevious: async (context) => {
                const root = await getPaginationRoot(context);
                const prevBtn = root.locator('button[aria-label="Go to previous page"]');
                if (await prevBtn.count() === 0 || await prevBtn.isDisabled()) return false;

                const displayedRows = root.locator('.MuiTablePagination-displayedRows');
                const oldText = await displayedRows.innerText().catch(() => '');

                await prevBtn.click({ force: true });

                let retries = 30; // 3 second timeout for client-side render
                while (oldText && retries-- > 0 && await displayedRows.innerText().catch(() => '') === oldText) {
                    await context.page.waitForTimeout(100);
                }

                if (context.config.strategies.loading?.isTableLoading) {
                    let loadingRetries = 20;
                    while (loadingRetries-- > 0 && await context.config.strategies.loading.isTableLoading(context)) {
                        await context.page.waitForTimeout(100);
                    }
                }
                return true;
            },
            goToFirst: async (context) => {
                const root = await getPaginationRoot(context);
                const prevBtn = root.locator('button[aria-label="Go to previous page"]');
                const displayedRows = root.locator('.MuiTablePagination-displayedRows');

                let maxRetries = 50;
                let clicked = false;
                while (maxRetries-- > 0 && await prevBtn.count() > 0 && !(await prevBtn.isDisabled())) {
                    const oldText = await displayedRows.innerText().catch(() => '');
                    await prevBtn.click();

                    let renderRetries = 30;
                    while (oldText && renderRetries-- > 0 && await displayedRows.innerText().catch(() => '') === oldText) {
                        await context.page.waitForTimeout(100);
                    }
                    clicked = true;
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

                // Poll for content update (React async render)
                let retries = 50; 
                while (oldText && retries-- > 0 && await displayedRows.innerText().catch(() => '') === oldText) {
                    await context.page.waitForTimeout(100);
                }
                
                // DataGrid specific: wait for overlay to disappear
                let loadingRetries = 30;
                const overlay = context.root.locator('.MuiDataGrid-overlay');
                while (loadingRetries-- > 0 && await overlay.isVisible().catch(() => false)) {
                    await context.page.waitForTimeout(100);
                }
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

                let retries = 50;
                while (oldText && retries-- > 0 && await displayedRows.innerText().catch(() => '') === oldText) {
                    await context.page.waitForTimeout(100);
                }

                let loadingRetries = 30;
                const overlay = context.root.locator('.MuiDataGrid-overlay');
                while (loadingRetries-- > 0 && await overlay.isVisible().catch(() => false)) {
                    await context.page.waitForTimeout(100);
                }
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
                    
                    // Wait for loading overlay
                    let loadingRetries = 30;
                    const overlay = context.root.locator('.MuiDataGrid-overlay');
                    while (loadingRetries-- > 0 && await overlay.isVisible().catch(() => false)) {
                        await context.page.waitForTimeout(100);
                    }
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
        loading: {
            isTableLoading: async (context) => {
                return await context.root.locator('.MuiDataGrid-overlay').isVisible().catch(() => false);
            }
        }
    }
};
