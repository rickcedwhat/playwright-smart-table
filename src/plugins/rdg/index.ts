import { TableContext, Selector, TableConfig } from '../../types';
import { PaginationStrategies } from '../../strategies/pagination';
import { StabilizationStrategies } from '../../strategies/stabilization';

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
