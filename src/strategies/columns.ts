// fallow-ignore-file circular-dependency
import type { Locator } from '@playwright/test';
import { StrategyContext } from '../types';

/**
 * Primitive navigation functions that define HOW to move within a table.
 * The orchestration logic (WHEN to move) lives in _navigateToCell.
 */
export interface NavigationPrimitives {
    goUp?: (context: StrategyContext) => Promise<void>;
    goDown?: (context: StrategyContext) => Promise<void>;
    goLeft?: (context: StrategyContext) => Promise<void>;
    goRight?: (context: StrategyContext) => Promise<void>;
    goHome?: (context: StrategyContext) => Promise<void>;
    /**
     * After vertical moves, run before horizontal steps when the target column index is 0.
     * Use for horizontally virtualized a11y tables (e.g. Glide) so `td[aria-colindex="1"]` exists again.
     * Do not reset vertical scroll here — RDG-style `goHome` is often unsuitable.
     */
    snapFirstColumnIntoView?: (context: StrategyContext) => Promise<void>;
    /**
     * Coarse horizontal reposition before goLeft/goRight steps (virtualized a11y grids).
     * Implementations should leave a small delta for the caller to correct with primitives.
     */
    seekColumnIndex?: (context: StrategyContext, columnIndex: number) => Promise<void>;
    /**
     * Override the settle delay (ms) after horizontal goLeft/goRight steps.
     * Defaults to `Math.min(2500, 60 + steps * 12)`. Tune when your grid settles faster or slower.
     */
    settleMs?: number;
    /**
     * Override the maximum poll window (ms) waiting for the active cell to confirm position.
     * Defaults to `Math.min(6000, 250 + steps * 25)`. Tune when accessibility updates lag differently.
     */
    maxWaitMs?: number;
}

/**
 * @deprecated Use NavigationPrimitives instead. This will be removed in a future version.
 * Defines the contract for a cell navigation strategy.
 */
// fallow-ignore-next-line unused-type
export type CellNavigationStrategy = (context: StrategyContext & {
    column: string;
    index: number;
    rowIndex?: number;
    activeCell?: { rowIndex: number; columnIndex: number; locator: Locator } | null;
}) => Promise<void>;

export const CellNavigationStrategies = {
    /**
     * Default strategy: Assumes column is accessible or standard scrolling works.
     * No specific action taken other than what Playwright's default locator handling does.
     */
    default: async () => {
        // No-op
    }
};
