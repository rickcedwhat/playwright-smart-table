import { StrategyContext } from '../types';
export interface ColumnResolutionStrategy {
    /**
     * Resolves a column name (string or Regex) to a column index.
     * Returns undefined if not found.
     */
    resolveIndex(options: {
        query: string | RegExp;
        headerMap: Map<string, number>;
        context: StrategyContext;
    }): number | undefined;
    /**
     * Resolves a column name to a clean string name (for error messages or debugging).
     */
    resolveName(options: {
        query: string | RegExp;
        headerMap: Map<string, number>;
    }): string;
}
export declare const ResolutionStrategies: {
    default: ColumnResolutionStrategy;
};
