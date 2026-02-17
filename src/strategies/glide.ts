import { expect } from '@playwright/test';
import { TableContext, FillStrategy } from '../types';
import { glideGoUp, glideGoDown, glideGoLeft, glideGoRight, glideGoHome } from './glide/columns';
import { scrollRightHeader } from './glide/headers';
import { PaginationStrategies } from './pagination';
import { StabilizationStrategies } from './stabilization';

/**
 * Fill strategy for Glide Data Grid with textarea validation.
 * This is the default strategy that works with the standard Glide Data Grid editor.
 */
export const glideFillStrategy: FillStrategy = async ({ value, page }) => {
    // Edit Cell
    await page.keyboard.press('Enter');
    // Wait for editor to appear
    const textarea = page.locator('textarea.gdg-input');
    await textarea.waitFor({ state: 'visible', timeout: 2000 });
    await page.keyboard.type(String(value));
    // Wait for textarea value to match what we typed
    await textarea.evaluate((el, expectedValue) => {
        return new Promise<void>((resolve) => {
            const checkValue = () => {
                if ((el as HTMLTextAreaElement).value === expectedValue) {
                    resolve();
                } else {
                    setTimeout(checkValue, 10);
                }
            };
            checkValue();
        });
    }, String(value));
    // Small delay to let the grid process the value
    await page.waitForTimeout(50);
    await page.keyboard.press('Enter');
    // Wait for editor to close (commit completed)
    await textarea.waitFor({ state: 'detached', timeout: 2000 });
    // Wait for accessibility layer to sync with canvas state
    await page.waitForTimeout(300);
};

/**
 * Simple fill strategy for Glide Data Grid.
 * Use this if your Glide implementation doesn't use the standard textarea editor.
 * This is faster but may not work for all Glide configurations.
 */
export const glideFillSimple: FillStrategy = async ({ value, page }) => {
    await page.keyboard.press('Enter');
    await page.keyboard.type(String(value));
    await page.keyboard.press('Enter');
};


export const glidePaginationStrategy = PaginationStrategies.infiniteScroll({
    scrollTarget: 'xpath=//ancestor::body//div[contains(@class, "dvn-scroller")]',
    scrollAmount: 500,
    action: 'js-scroll',
    stabilization: StabilizationStrategies.contentChanged({ timeout: 5000 }),
    timeout: 5000 // Overall timeout
});

export const glideGetCellLocator = ({ row, columnIndex }: any) => {
    // Use relative locator to support virtualization (where rowIndex resets or is offsets)
    // The accessibility DOM usually contains 'td' elements with the data.
    return row.locator('td').nth(columnIndex);
};

export const glideGetActiveCell = async ({ page }: any) => {
    // Find the focused cell/element
    // Use broad selector for focused element
    const focused = page.locator('*:focus').first();

    if (await focused.count() === 0) return null;

    // Debug log
    if (process.env.DEBUG) console.log('Found focused element:', await focused.evaluate((e: any) => e.outerHTML));

    // Try to extract position from ID if possible
    const id = await focused.getAttribute('id') || '';
    // Expected format: glide-cell-COL-ROW
    const parts = id.split('-');

    let rowIndex = -1;
    let columnIndex = -1;

    if (parts.length >= 4 && parts[0] === 'glide' && parts[1] === 'cell') {
        columnIndex = parseInt(parts[2]) - 1; // 1-based in ID to 0-based
        rowIndex = parseInt(parts[3]);
    } else {
        // Fallback: If we can't parse ID, we assume it's the correct cell 
        // because we just navigated to it. 
        // Returning -1 indices might be confusing but won't stop smartRow from using the locator.
    }

    return {
        rowIndex,
        columnIndex,
        locator: focused
    };
};

export const GlideStrategies = {
    fill: glideFillStrategy,
    fillSimple: glideFillSimple,
    pagination: glidePaginationStrategy,
    header: scrollRightHeader,
    navigation: {
        goUp: glideGoUp,
        goDown: glideGoDown,
        goLeft: glideGoLeft,
        goRight: glideGoRight,
        goHome: glideGoHome
    },
    getCellLocator: glideGetCellLocator,
    getActiveCell: glideGetActiveCell
};
