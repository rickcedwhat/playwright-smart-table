import type { PaginationStrategy, SortingStrategy, FillStrategy } from '../types';
/**
 * Validates that a pagination strategy returns a boolean.
 * @param result - The result from a pagination strategy
 * @param strategyName - Name of the strategy for error messages
 */
export declare function validatePaginationResult(result: any, strategyName?: string): boolean;
/**
 * Validates that a pagination strategy is properly configured.
 * @param strategy - The pagination strategy to validate
 */
export declare function validatePaginationStrategy(strategy: any): strategy is PaginationStrategy;
/**
 * Validates that a sorting strategy has the required methods.
 * @param strategy - The sorting strategy to validate
 */
export declare function validateSortingStrategy(strategy: any): strategy is SortingStrategy;
/**
 * Validates that a fill strategy is properly configured.
 * @param strategy - The fill strategy to validate
 */
export declare function validateFillStrategy(strategy: any): strategy is FillStrategy;
