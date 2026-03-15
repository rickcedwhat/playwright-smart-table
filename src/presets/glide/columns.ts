import { StrategyContext } from '../../types';

/**
 * Primitive navigation functions for Glide Data Grid.
 * These define HOW to move, not WHEN to move.
 * The orchestration logic lives in _navigateToCell.
 */

export const glideGoUp = async (context: StrategyContext) => {
    await context.page.keyboard.press('ArrowUp');
};

export const glideGoDown = async (context: StrategyContext) => {
    await context.page.keyboard.press('ArrowDown');
};

export const glideGoLeft = async (context: StrategyContext) => {
    await context.page.keyboard.press('ArrowLeft');
};

export const glideGoRight = async (context: StrategyContext) => {
    await context.page.keyboard.press('ArrowRight');
};

export const glideGoHome = async (context: StrategyContext) => {
    const { root, page } = context;

    // Glide renders to canvas - the accessibility table (root) is inside the canvas
    await root.evaluate((el) => {
        const canvas = el.closest('canvas') || el.parentElement?.querySelector('canvas');
        if (canvas instanceof HTMLCanvasElement) {
            canvas.tabIndex = 0;
            canvas.focus();
        }
    });
    await page.waitForTimeout(100);

    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Meta+ArrowUp');
    await page.keyboard.press('Home');
    await page.waitForTimeout(150);
};
