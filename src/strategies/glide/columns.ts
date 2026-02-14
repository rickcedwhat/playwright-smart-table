import { Page, Locator } from '@playwright/test';
import { StrategyContext } from '../../types';

/**
 * Strategy that clicks into the table to establish focus and then uses the Right Arrow key
 * to navigate to the target CELL (navigates down to the row, then right to the column).
 * 
 * Useful for canvas-based grids like Glide where DOM scrolling might not be enough for interaction
 * or where keyboard navigation is the primary way to move focus.
 */
export const keyboardCellNavigation = async (context: StrategyContext & { column: string, index: number, rowIndex?: number }) => {
    const { root, page, index, rowIndex } = context;

    if (typeof rowIndex !== 'number') {
        throw new Error('Row index is required for keyboard navigation');
    }

    await root.focus();
    await page.waitForTimeout(100);

    // Robust Navigation:
    // 1. Jump to Top-Left (Reset) - Sequence for Cross-OS (Mac/Windows)
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Meta+ArrowUp'); // Mac Go-To-Top
    await page.keyboard.press('Home'); // Ensure start of row
    await page.waitForTimeout(150);

    // 2. Move Down to Target Row
    for (let i = 0; i < rowIndex; i++) {
        await page.keyboard.press('ArrowDown');
    }
    // 3. Move Right to Target Column
    for (let i = 0; i < index; i++) {
        await page.keyboard.press('ArrowRight');
    }
    await page.waitForTimeout(50);
};
