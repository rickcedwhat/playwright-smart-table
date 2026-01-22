import { StrategyContext } from '../types';

/**
 * Defines the contract for a cell navigation strategy.
 * It is responsible for ensuring a specific CELL is visible/focused (navigates to row + column),
 * typically by scrolling or using keyboard navigation.
 */
export type CellNavigationStrategy = (context: StrategyContext & { column: string, index: number, rowIndex?: number }) => Promise<void>;

export const CellNavigationStrategies = {
    /**
     * Default strategy: Assumes column is accessible or standard scrolling works.
     * No specific action taken other than what Playwright's default locator handling does.
     */
    default: async () => {
        // No-op
    }
};
