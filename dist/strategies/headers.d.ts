import { StrategyContext } from '../types';
/**
 * Defines the contract for a header retrieval strategy.
 * Returns a list of unique header names found in the table.
 */
export type HeaderStrategy = (context: StrategyContext) => Promise<string[]>;
export declare const HeaderStrategies: {
    /**
     * Default strategy: Returns only the headers currently visible in the DOM.
     * This is fast but won't find virtualized columns off-screen.
     */
    visible: ({ config, resolve, root }: StrategyContext) => Promise<string[]>;
    /**
     * Scans for headers by finding a scrollable container and setting scrollLeft.
     */
    scrollRight: (context: StrategyContext, options?: {
        limit?: number;
        selector?: string;
        scrollAmount?: number;
    }) => Promise<string[]>;
    /**
     * Strategy that clicks into the table to establish focus and then uses the Right Arrow key
     * to navigate cell-by-cell, collecting headers found along the way.
     */
    keyboard: (context: StrategyContext, options?: {
        limit?: number;
        maxSilentClicks?: number;
    }) => Promise<string[]>;
};
