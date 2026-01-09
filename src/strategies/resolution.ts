import { Locator, Page } from '@playwright/test';
import { StrategyContext } from '../types';

export interface ColumnResolutionStrategy {
    /**
     * Resolves a column name (string or Regex) to a column index.
     * Returns undefined if not found.
     */
    resolveIndex(options: {
        query: string | RegExp;
        headerMap: Map<string, number>;
        context: StrategyContext
    }): number | undefined;

    /**
     * Resolves a column name to a clean string name (for error messages or debugging).
     */
    resolveName(options: {
        query: string | RegExp;
        headerMap: Map<string, number>;
    }): string;
}

export const ResolutionStrategies = {
    default: {
        resolveIndex: ({ query, headerMap }) => {
            // 1. Exact / String Match
            if (typeof query === 'string') {
                if (headerMap.has(query)) return headerMap.get(query);
            }

            // 2. Regex Match
            if (query instanceof RegExp) {
                for (const [colName, idx] of headerMap.entries()) {
                    if (query.test(colName)) return idx;
                }
                return undefined;
            }

            // 3. (Optional) Fuzzy String Match fallback could go here
            // But for strict default strategy, we might want to keep it simple first
            // The original code didn't do fuzzy *resolution* logic inside the get(), it just did strict get().
            // The fuzzy logic was only for *suggestions* on error.
            return undefined;
        },

        resolveName: ({ query }) => {
            return query.toString();
        }
    } as ColumnResolutionStrategy
};
