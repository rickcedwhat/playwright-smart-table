
import { StrategyContext } from '../types';

/**
 * Defines the contract for a column navigation strategy.
 * It is responsible for ensuring a specific column is visible/focused,
 * typically by scrolling or navigating to it.
 */
export type ColumnStrategy = (context: StrategyContext & { column: string, index: number, rowIndex?: number }) => Promise<void>;

export const ColumnStrategies = {
    /**
     * Default strategy: Assumes column is accessible or standard scrolling works.
     * No specific action taken other than what Playwright's default locator handling does.
     */
    default: async () => {
        // No-op
    },

    /**
     * Strategy that clicks into the table to establish focus and then uses the Right Arrow key
     * to navigate to the target column index.
     * 
     * Useful for canvas-based grids like Glide where DOM scrolling might not be enough for interaction
     * or where keyboard navigation is the primary way to move focus.
     */
    keyboard: async (context: StrategyContext & { column: string, index: number, rowIndex?: number }) => {
        const { root, page, index, rowLocator, rowIndex } = context;

        if (typeof rowIndex !== 'number') {
            throw new Error('Row index is required for keyboard navigation');
        }

        console.log(`[ColumnStrat:keyboard] Using Row Index Navigation: Row ${rowIndex}, Col ${index}`);

        await root.focus();
        // await page.keyboard.press('Tab');
        await page.waitForTimeout(200);
        const activeIdAfterClick = await root.locator('td[aria-selected="true"]').getAttribute('id').catch(() => undefined);
        console.log(`[ColumnStrat:keyboard] Clicked into table to establish focus`, { id: activeIdAfterClick });


        // Robust Navigation:
        // 1. Jump to Top-Left (Reset) - Sequence for Cross-OS (Mac/Windows)
        await page.keyboard.press('Control+Home');
        await page.keyboard.press('Meta+ArrowUp'); // Mac Go-To-Top
        await page.keyboard.press('Home'); // Ensure start of row
        await page.waitForTimeout(300);

        // Debug: Check focus after Reset
        const activeIdAfterReset = await root.locator('td[aria-selected="true"]').getAttribute('id').catch(() => undefined);
        console.log(`[ColumnStrat:keyboard] Focus after reset:`, { id: activeIdAfterReset });

        // 2. Move Down to Target Row
        for (let i = 0; i < rowIndex; i++) {
            await page.keyboard.press('ArrowDown');
        }
        // 3. Move Right to Target Column
        for (let i = 0; i < index; i++) {
            await page.keyboard.press('ArrowRight');
        }
        await page.waitForTimeout(100);
        const activeIdAfterMove = await root.locator('td[aria-selected="true"]').getAttribute('id').catch(() => undefined);
        console.log(`[ColumnStrat:keyboard] Focus after move:`, { id: activeIdAfterMove });

        await page.waitForTimeout(100);
    }
};

