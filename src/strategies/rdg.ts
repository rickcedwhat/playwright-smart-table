import { TableContext, Selector } from '../types';

/**
 * Scrolls the grid horizontally to collect all column headers.
 * Handles empty headers by labeling them (e.g. "Checkbox").
 */
export const scrollRightHeaderRDG = async (context: TableContext) => {
    const { resolve, config, root, page } = context;
    const collectedHeaders = new Set<string>();

    const gridHandle = await root.evaluateHandle((el) => {
        return el.querySelector('[role="grid"]') || el.closest('[role="grid"]');
    });

    const scrollContainer = gridHandle; // RDG usually scrolls the grid container itself


    const expectedColumns = await gridHandle.evaluate(el =>
        el ? parseInt(el.getAttribute('aria-colcount') || '0', 10) : 0
    );

    const getVisible = async () => {
        const headerLoc = resolve(config.headerSelector as Selector, root);
        const texts = await headerLoc.allInnerTexts();
        return texts.map(t => {
            const trimmed = t.trim();
            // Assign a name to empty headers (like selection checkboxes)
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
        // Safety break at 30 iterations to prevent infinite loops
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

/**
 * Uses a row-relative locator to avoid issues with absolute aria-rowindex 
 * changing during pagination/scrolling.
 */
export const rdgGetCellLocator = ({ row, columnIndex }: any) => {
    const ariaColIndex = columnIndex + 1;
    return row.locator(`[role="gridcell"][aria-colindex="${ariaColIndex}"]`);
};



/**
 * Scrolls the grid vertically to load more virtualized rows.
 */
import { PaginationStrategies } from './pagination';
import { StabilizationStrategies } from './stabilization';

/**
 * Scrolls the grid vertically to load more virtualized rows.
 */
export const rdgPaginationStrategy = PaginationStrategies.infiniteScroll({
    action: 'js-scroll',
    scrollAmount: 500,
    stabilization: StabilizationStrategies.contentChanged({ timeout: 5000 })
});

export const rdgNavigation = {
    goRight: async ({ root, page }: any) => {
        await root.evaluate((el: HTMLElement) => {
            // Find grid container
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

export const RDGStrategies = {
    header: scrollRightHeaderRDG,
    getCellLocator: rdgGetCellLocator,
    navigation: rdgNavigation,
    pagination: rdgPaginationStrategy
};
