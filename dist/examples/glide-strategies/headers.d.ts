import { StrategyContext } from '../../src/types';
/**
 * Scans for headers by finding a scrollable container and setting scrollLeft.
 */
export declare const scrollRightHeader: (context: StrategyContext, options?: {
    limit?: number;
    selector?: string;
    scrollAmount?: number;
}) => Promise<string[]>;
