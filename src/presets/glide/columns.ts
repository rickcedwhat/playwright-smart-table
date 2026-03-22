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

// Horizontal: use page `.dvn-scroller` (canvas root is not its ancestor). Virtualized rows expose
// a small window of `td[aria-colindex]` that shifts with scrollLeft.
const nudgePageScroller = async (page: StrategyContext['page'], delta: number) => {
    const scroller = page.locator('.dvn-scroller').first();
    await scroller.evaluate((el, d: number) => {
        el.scrollLeft += d;
    }, delta);
};

export const glideGoLeft = async (context: StrategyContext) => {
    await nudgePageScroller(context.page, -400);
};

export const glideGoRight = async (context: StrategyContext) => {
    await nudgePageScroller(context.page, 400);
};

/** Coarse `scrollLeft` toward `columnIndex`; `goLeft`/`goRight` correct the remainder. */
export const glideSeekColumnIndex = async (context: StrategyContext, columnIndex: number) => {
    const { page } = context;
    const scroller = page.locator('.dvn-scroller').first();
    await scroller.evaluate((el, colIdx: number) => {
        const max = Math.max(0, el.scrollWidth - el.clientWidth);
        const ratio = Math.min(1, Math.max(0, (colIdx + 0.5) / 64));
        el.scrollLeft = Math.floor(ratio * max);
    }, columnIndex);
    await page.waitForTimeout(100);
};

/** `scrollLeft = 0` so low `aria-colindex` cells exist again (see smartRow for optional `Home`). */
export const glideSnapFirstColumnIntoView = async (context: StrategyContext) => {
    const { page } = context;
    await page.locator('.dvn-scroller').first().evaluate((el) => {
        el.scrollLeft = 0;
    });
    await page.waitForTimeout(150);
};
