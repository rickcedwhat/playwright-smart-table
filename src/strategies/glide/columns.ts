import { Page, Locator } from '@playwright/test';
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

    await root.focus();
    await page.waitForTimeout(100);

    // Reset to top-left - Cross-OS sequence (Mac/Windows)
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Meta+ArrowUp'); // Mac Go-To-Top
    await page.keyboard.press('Home'); // Ensure start of row
    await page.waitForTimeout(150);
};
