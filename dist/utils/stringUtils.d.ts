/**
 * Calculate Levenshtein distance between two strings
 * Used for "did you mean?" suggestions
 */
export declare function levenshteinDistance(a: string, b: string): number;
/**
 * Calculate similarity score between two strings (0-1)
 * 1 = identical, 0 = completely different
 */
export declare function stringSimilarity(a: string, b: string): number;
/**
 * Find similar strings from a list
 * Returns matches above threshold, sorted by similarity
 */
export declare function findSimilar(input: string, available: string[], threshold?: number): Array<{
    value: string;
    score: number;
}>;
/**
 * Build a helpful error message for column not found
 */
export declare function buildColumnNotFoundError(columnName: string, availableColumns: string[]): string;
