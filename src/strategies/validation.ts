import type { PaginationStrategy, SortingStrategy, FillStrategy } from '../types';

/**
 * Validates that a pagination strategy returns a boolean.
 * @param result - The result from a pagination strategy
 * @param strategyName - Name of the strategy for error messages
 */
export function validatePaginationResult(result: any, strategyName: string = 'Custom Pagination Strategy'): boolean {
    if (typeof result !== 'boolean') {
        throw new Error(
            `[${strategyName}] Pagination strategy must return a boolean (true if paginated, false if no more pages). ` +
            `Received: ${typeof result} (${JSON.stringify(result)})`
        );
    }
    return result;
}

/**
 * Validates that a pagination strategy is properly configured.
 * @param strategy - The pagination strategy to validate
 */
export function validatePaginationStrategy(strategy: any): strategy is PaginationStrategy {
    if (typeof strategy !== 'function') {
        throw new Error(
            `Pagination strategy must be a function. Received: ${typeof strategy}`
        );
    }
    return true;
}

/**
 * Validates that a sorting strategy has the required methods.
 * @param strategy - The sorting strategy to validate
 */
export function validateSortingStrategy(strategy: any): strategy is SortingStrategy {
    if (!strategy || typeof strategy !== 'object') {
        throw new Error(
            `Sorting strategy must be an object with 'doSort' and 'getSortState' methods. Received: ${typeof strategy}`
        );
    }

    if (typeof strategy.doSort !== 'function') {
        throw new Error(
            `Sorting strategy must have a 'doSort' method. Missing or not a function.`
        );
    }

    if (typeof strategy.getSortState !== 'function') {
        throw new Error(
            `Sorting strategy must have a 'getSortState' method. Missing or not a function.`
        );
    }

    return true;
}

/**
 * Validates that a fill strategy is properly configured.
 * @param strategy - The fill strategy to validate
 */
export function validateFillStrategy(strategy: any): strategy is FillStrategy {
    if (typeof strategy !== 'function') {
        throw new Error(
            `Fill strategy must be a function. Received: ${typeof strategy}`
        );
    }
    return true;
}
