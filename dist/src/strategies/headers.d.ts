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
};
