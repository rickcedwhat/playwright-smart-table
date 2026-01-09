
import { StrategyContext } from '../types';

/**
 * Defines the contract for a cell navigation strategy.
 * It is responsible for ensuring a specific CELL is visible/focused (navigates to row + column),
 * typically by scrolling or using keyboard navigation.
 */
export type CellNavigationStrategy = (context: StrategyContext & { column: string, index: number, rowIndex?: number }) => Promise<void>;

/** @deprecated Use CellNavigationStrategy instead */
export type ColumnStrategy = CellNavigationStrategy;

export const CellNavigationStrategies = {
    /**
     * Default strategy: Assumes column is accessible or standard scrolling works.
     * No specific action taken other than what Playwright's default locator handling does.
     */
    default: async () => {
        // No-op
    },

    /**
     * Strategy that clicks into the table to establish focus and then uses the Right Arrow key
     * to navigate to the target CELL (navigates down to the row, then right to the column).
     * 
     * Useful for canvas-based grids like Glide where DOM scrolling might not be enough for interaction
     * or where keyboard navigation is the primary way to move focus.
     */
    keyboard: async (context: StrategyContext & { column: string, index: number, rowIndex?: number }) => {
        const { root, page, index, rowLocator, rowIndex } = context;

        if (typeof rowIndex !== 'number') {
            throw new Error('Row index is required for keyboard navigation');
        }

        await root.focus();
        await page.waitForTimeout(200);

        // Robust Navigation:
        // 1. Jump to Top-Left (Reset) - Sequence for Cross-OS (Mac/Windows)
        await page.keyboard.press('Control+Home');
        await page.keyboard.press('Meta+ArrowUp'); // Mac Go-To-Top
        await page.keyboard.press('Home'); // Ensure start of row
        await page.waitForTimeout(300);

        // 2. Move Down to Target Row
        for (let i = 0; i < rowIndex; i++) {
            await page.keyboard.press('ArrowDown');
        }
        // 3. Move Right to Target Column
        for (let i = 0; i < index; i++) {
            await page.keyboard.press('ArrowRight');
        }
        await page.waitForTimeout(100);
    }
};

// Backwards compatibility - deprecated
/** @deprecated Use CellNavigationStrategies instead */
export const ColumnStrategies = CellNavigationStrategies;
