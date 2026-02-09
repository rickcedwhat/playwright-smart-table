import { TableContext } from '../types';
/**
 * A Stabilization Strategy determines when a table has "settled" after an action.
 * It wraps the action to capture state before and after.
 */
export type StabilizationStrategy = (context: TableContext, action: () => Promise<void>) => Promise<boolean>;
export declare const StabilizationStrategies: {
    /**
     * Waits for the visible text of the table rows to change.
     */
    contentChanged: (options?: {
        scope?: "all" | "first";
        timeout?: number;
    }) => StabilizationStrategy;
    /**
     * Waits for the total number of rows to strictly increase.
     */
    rowCountIncreased: (options?: {
        timeout?: number;
    }) => StabilizationStrategy;
    /**
     * Waits for a specific network condition or spinner to disappear.
     * Useful for tables that have explicit loading states but might not change content immediately.
     */
    networkIdle: (options?: {
        spinnerSelector?: string;
        timeout?: number;
    }) => StabilizationStrategy;
};
