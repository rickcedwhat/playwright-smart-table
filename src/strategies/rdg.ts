import { TableContext } from '../types';

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

    const expectedColumns = await gridHandle.evaluate(el =>
        el ? parseInt(el.getAttribute('aria-colcount') || '0', 10) : 0
    );

    const getVisible = async () => {
        const headerLoc = resolve(config.headerSelector, root);
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
 * Scrolls virtualized columns into view before reading.
 */
export const rdgCellNavigation = async ({ root, page, index }: any) => {
    // Check if the column header is visible and scroll horizontally if needed
    const headerCell = root.locator(`[role="columnheader"][aria-colindex="${index + 1}"]`);
    const isVisible = await headerCell.isVisible().catch(() => false);

    if (!isVisible) {
        const estimatedScroll = index * 150;
        await root.evaluate((el: HTMLElement, scrollAmount: number) => {
            el.scrollLeft = scrollAmount;
        }, estimatedScroll);
        await page.waitForTimeout(300);
    }
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

export const RDGStrategies = {
    header: scrollRightHeaderRDG,
    getCellLocator: rdgGetCellLocator,
    cellNavigation: rdgCellNavigation,
    pagination: rdgPaginationStrategy
};
