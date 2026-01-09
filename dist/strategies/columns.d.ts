import { StrategyContext } from '../types';
/**
 * Defines the contract for a cell navigation strategy.
 * It is responsible for ensuring a specific CELL is visible/focused (navigates to row + column),
 * typically by scrolling or using keyboard navigation.
 */
export type CellNavigationStrategy = (context: StrategyContext & {
    column: string;
    index: number;
    rowIndex?: number;
}) => Promise<void>;
/** @deprecated Use CellNavigationStrategy instead */
export type ColumnStrategy = CellNavigationStrategy;
export declare const CellNavigationStrategies: {
    /**
     * Default strategy: Assumes column is accessible or standard scrolling works.
     * No specific action taken other than what Playwright's default locator handling does.
     */
    default: () => Promise<void>;
    /**
     * Strategy that clicks into the table to establish focus and then uses the Right Arrow key
     * to navigate to the target CELL (navigates down to the row, then right to the column).
     *
     * Useful for canvas-based grids like Glide where DOM scrolling might not be enough for interaction
     * or where keyboard navigation is the primary way to move focus.
     */
    keyboard: (context: StrategyContext & {
        column: string;
        index: number;
        rowIndex?: number;
    }) => Promise<void>;
};
/** @deprecated Use CellNavigationStrategies instead */
export declare const ColumnStrategies: {
    /**
     * Default strategy: Assumes column is accessible or standard scrolling works.
     * No specific action taken other than what Playwright's default locator handling does.
     */
    default: () => Promise<void>;
    /**
     * Strategy that clicks into the table to establish focus and then uses the Right Arrow key
     * to navigate to the target CELL (navigates down to the row, then right to the column).
     *
     * Useful for canvas-based grids like Glide where DOM scrolling might not be enough for interaction
     * or where keyboard navigation is the primary way to move focus.
     */
    keyboard: (context: StrategyContext & {
        column: string;
        index: number;
        rowIndex?: number;
    }) => Promise<void>;
};
