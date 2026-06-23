import { TableContext, Selector, TableConfig, ViewportStrategy } from '../types';
import { PaginationStrategies } from '../strategies/pagination';
import { StabilizationStrategies } from '../strategies/stabilization';

/**
 * Scrolls the grid horizontally to collect all column headers.
 * Handles empty headers by labeling them (e.g. "Checkbox").
 */
const scrollRightHeaderRDG = async (context: TableContext) => {
    const { resolve, config, root, page } = context;
    const collectedHeaders = new Set<string>();

    const gridHandle = await root.evaluateHandle((el) => {
        return el.querySelector('[role="grid"]') || el.closest('[role="grid"]');
    });

    const expectedColumns = await gridHandle.evaluate(el =>
        el ? parseInt(el.getAttribute('aria-colcount') || '0', 10) : 0
    );

    const getVisible = async () => {
        const headerLoc = resolve(config.headerSelector as Selector, root);
        const texts = await headerLoc.allInnerTexts();
        return texts.map(t => {
            const trimmed = t.trim();
            return trimmed.length > 0 ? trimmed : 'Checkbox';
        });
    };

    let currentHeaders = await getVisible();
    currentHeaders.forEach(h => collectedHeaders.add(h));

    const hasScroll = await gridHandle.evaluate(el =>
        el ? el.scrollWidth > el.clientWidth : false
    );

    if (hasScroll) {
        await gridHandle.evaluate(el => el!.scrollLeft = 0);
        await page.waitForTimeout(200);

        let iteration = 0;
        while (collectedHeaders.size < expectedColumns && iteration < 30) {
            await gridHandle.evaluate(el => el!.scrollLeft += 500);
            await page.waitForTimeout(300);

            const newHeaders = await getVisible();
            newHeaders.forEach(h => collectedHeaders.add(h));

            const atEnd = await gridHandle.evaluate(el =>
                el!.scrollLeft >= el!.scrollWidth - el!.clientWidth - 10
            );

            iteration++;
            if (atEnd) break;
        }

        await gridHandle.evaluate(el => el!.scrollLeft = 0);
        await page.waitForTimeout(200);
    }

    return Array.from(collectedHeaders);
};

const rdgGetCellLocator = ({ row, columnIndex }: any) => {
    const ariaColIndex = columnIndex + 1;
    return row.locator(`[role="gridcell"][aria-colindex="${ariaColIndex}"]`);
};

const rdgPaginationStrategy = PaginationStrategies.infiniteScroll({
    action: 'js-scroll',
    scrollAmount: 500,
    stabilization: StabilizationStrategies.contentChanged({ timeout: 5000 })
});

const rdgNavigation = {
    goRight: async ({ root, page }: any) => {
        await root.evaluate((el: HTMLElement) => {
            const grid = el.querySelector('[role="grid"]') || el.closest('[role="grid"]') || el;
            if (grid) grid.scrollLeft += 150;
        });
    },
    goLeft: async ({ root, page }: any) => {
        await root.evaluate((el: HTMLElement) => {
            const grid = el.querySelector('[role="grid"]') || el.closest('[role="grid"]') || el;
            if (grid) grid.scrollLeft -= 150;
        });
    },
    goDown: async ({ root, page }: any) => {
        await root.evaluate((el: HTMLElement) => {
            const grid = el.querySelector('[role="grid"]') || el.closest('[role="grid"]') || el;
            if (grid) grid.scrollTop += 35;
        });
    },
    goUp: async ({ root, page }: any) => {
        await root.evaluate((el: HTMLElement) => {
            const grid = el.querySelector('[role="grid"]') || el.closest('[role="grid"]') || el;
            if (grid) grid.scrollTop -= 35;
        });
    },
    goHome: async ({ root, page }: any) => {
        await root.evaluate((el: HTMLElement) => {
            const grid = el.querySelector('[role="grid"]') || el.closest('[role="grid"]') || el;
            if (grid) {
                grid.scrollLeft = 0;
                grid.scrollTop = 0;
            }
        });
    }
};

/** Default strategies for the RDG preset (used when you spread Plugins.RDG). */
const RDGDefaultStrategies = {
    header: scrollRightHeaderRDG,
    getCellLocator: rdgGetCellLocator,
    navigation: rdgNavigation,
    pagination: rdgPaginationStrategy
};

/** Full strategies for React Data Grid. Use when you want to supply your own selectors: strategies: Plugins.RDG.Strategies */
// fallow-ignore-next-line unused-export
export const RDGStrategies = RDGDefaultStrategies;

/**
 * Full preset for React Data Grid (selectors + default strategies).
 * Spread: useTable(loc, { ...Plugins.RDG, maxPages: 5 }).
 * Strategies only: useTable(loc, { rowSelector: '...', strategies: Plugins.RDG.Strategies }).
 */
const RDGPreset: Partial<TableConfig> = {
    rowSelector: '[role="row"].rdg-row',
    headerSelector: '[role="columnheader"]',
    cellSelector: '[role="gridcell"]',
    strategies: RDGDefaultStrategies
};
export const RDG: Partial<TableConfig> & { Strategies: typeof RDGStrategies } = Object.defineProperty(
    RDGPreset,
    'Strategies',
    { get: () => RDGStrategies, enumerable: false }
) as Partial<TableConfig> & { Strategies: typeof RDGStrategies };

// ---------------------------------------------------------------------------
// rdg2D — React Data Grid with both rows AND columns virtualized
// ---------------------------------------------------------------------------

const rdg2DViewportStrategy: ViewportStrategy = {
    getVisibleRowRange: async ({ root }) => {
        return root.evaluate((el) => {
            const rows = [...el.querySelectorAll('[role="row"][aria-rowindex]')];
            const indices = rows.map(r => parseInt(r.getAttribute('aria-rowindex') || '0', 10) - 1);
            if (!indices.length) return { first: 0, last: 0 };
            return { first: Math.min(...indices), last: Math.max(...indices) };
        });
    },

    getVisibleColumnRange: async ({ root }) => {
        return root.evaluate((el) => {
            const cells = [...el.querySelectorAll('[role="gridcell"][aria-colindex]')];
            const indices = cells.map(c => parseInt(c.getAttribute('aria-colindex') || '0', 10) - 1);
            if (!indices.length) return { first: 0, last: 0 };
            return { first: Math.min(...indices), last: Math.max(...indices) };
        });
    },

    scrollToRow: async ({ root }, rowIndex) => {
        await root.evaluate((el, rowIndex) => {
            const grid = (el.querySelector('[role="grid"]') || el.closest('[role="grid"]') || el) as HTMLElement;

            // Try to locate the target row by aria-rowindex (1-based in RDG)
            const ariaIndex = rowIndex + 1;
            const targetRow = el.querySelector(`[role="row"][aria-rowindex="${ariaIndex}"]`) as HTMLElement | null;
            if (targetRow) {
                const top = parseInt(targetRow.style.top || '0', 10);
                grid.scrollTop = Math.max(0, top - grid.clientHeight / 3);
                return;
            }

            // Row not in DOM — estimate position from an actual visible row's height
            const anyRow = el.querySelector('[role="row"][aria-rowindex]') as HTMLElement | null;
            const rowHeight = anyRow ? anyRow.getBoundingClientRect().height || 35 : 35;
            grid.scrollTop = Math.max(0, rowIndex * rowHeight - grid.clientHeight / 3);
        }, rowIndex);
    },

    scrollToColumn: async ({ root }, columnIndex) => {
        await root.evaluate((el, columnIndex) => {
            const grid = (el.querySelector('[role="grid"]') || el.closest('[role="grid"]') || el) as HTMLElement;

            // Try to locate the header cell by aria-colindex (1-based in RDG)
            const ariaIndex = columnIndex + 1;
            const header = el.querySelector(`[role="columnheader"][aria-colindex="${ariaIndex}"]`) as HTMLElement | null;
            if (header) {
                grid.scrollLeft = header.offsetLeft;
                return;
            }

            // Column not visible — estimate from average width of visible headers
            const headers = [...el.querySelectorAll('[role="columnheader"][aria-colindex]')] as HTMLElement[];
            if (headers.length > 0) {
                const avgWidth = headers.reduce((sum, h) => sum + h.offsetWidth, 0) / headers.length;
                grid.scrollLeft = Math.max(0, columnIndex * avgWidth);
            }
        }, columnIndex);
    },
};

/** Default strategies for the RDG2D preset (extends RDG with viewport recovery). */
const RDG2DDefaultStrategies = {
    ...RDGDefaultStrategies,
    viewport: rdg2DViewportStrategy,
};

// fallow-ignore-next-line unused-export
export const RDG2DStrategies = RDG2DDefaultStrategies;

/**
 * Full preset for React Data Grid with 2D virtualization (rows + columns both virtualized).
 * Use instead of `rdg` when horizontal scrolling causes "could not reach cell" errors.
 * The viewport strategy detects when a row is evicted by a horizontal scroll and restores it.
 */
const RDG2DPreset: Partial<TableConfig> = {
    ...RDGPreset,
    strategies: RDG2DDefaultStrategies,
};
export const RDG2D: Partial<TableConfig> & { Strategies: typeof RDG2DStrategies } = Object.defineProperty(
    RDG2DPreset,
    'Strategies',
    { get: () => RDG2DStrategies, enumerable: false }
) as Partial<TableConfig> & { Strategies: typeof RDG2DStrategies };
