import { expect } from '@playwright/test';
import { TableContext, FillStrategy } from '../types';
import { keyboardCellNavigation } from '../../examples/glide-strategies/columns';
import { scrollRightHeader } from '../../examples/glide-strategies/headers';

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

export const glidePaginationStrategy = async ({ root }: TableContext) => {
    // Strategy: Scroll the overlay container.
    // We need to find the scroller within the same frame as the root.
    // Using xpath to go up to body and find the scroller ensures we stay in the frame.
    const scroller = root.locator('xpath=//ancestor::body//div[contains(@class, "dvn-scroller")]').first();
    await expect(scroller).toBeAttached();

    // Force scroll via JS (most reliable for virtual lists)
    await scroller.evaluate(div => div.scrollTop += 500);

    // Wait for virtual rows to render
    // We use root.page() for timeout which is fine (global timer)
    await root.page().waitForTimeout(500);

    return true;
};

export const glideGetCellLocator = ({ page, columnIndex, rowIndex }: any) => {
    // Glide uses 1-based colIndex for data cells (colIndex 0 is row header usually)
    // rowIndex seems to be 0-based in the ID based on "glide-cell-1-0"
    return page.locator(`#glide-cell-${columnIndex + 1}-${rowIndex}`);
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
    pagination: glidePaginationStrategy,
    header: scrollRightHeader,
    cellNavigation: keyboardCellNavigation,
    getCellLocator: glideGetCellLocator,
    getActiveCell: glideGetActiveCell
};
