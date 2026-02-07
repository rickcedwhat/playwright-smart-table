import { DedupeStrategy } from '../types';
export declare const DedupeStrategies: {
    /**
     * Deduplicates rows based on their vertical position (Y coordinate).
     * Useful for virtualized tables where row DOM elements are reused but content changes.
     * @param tolerance Pixel tolerance for position comparison (default: 2)
     */
    byTopPosition: (tolerance?: number) => DedupeStrategy;
};
