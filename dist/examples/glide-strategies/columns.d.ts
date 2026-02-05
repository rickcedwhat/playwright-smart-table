import { StrategyContext } from '../../src/types';
/**
 * Strategy that clicks into the table to establish focus and then uses the Right Arrow key
 * to navigate to the target CELL (navigates down to the row, then right to the column).
 *
 * Useful for canvas-based grids like Glide where DOM scrolling might not be enough for interaction
 * or where keyboard navigation is the primary way to move focus.
 */
export declare const keyboardCellNavigation: (context: StrategyContext & {
    column: string;
    index: number;
    rowIndex?: number;
}) => Promise<void>;
