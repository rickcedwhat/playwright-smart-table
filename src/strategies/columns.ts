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
}

/**
 * @deprecated Use NavigationPrimitives instead. This will be removed in a future version.
 * Defines the contract for a cell navigation strategy.
 */
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
