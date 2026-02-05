"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.levenshteinDistance = levenshteinDistance;
exports.stringSimilarity = stringSimilarity;
exports.findSimilar = findSimilar;
exports.buildColumnNotFoundError = buildColumnNotFoundError;
/**
 * Calculate Levenshtein distance between two strings
 * Used for "did you mean?" suggestions
 */
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1 // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}
/**
 * Calculate similarity score between two strings (0-1)
 * 1 = identical, 0 = completely different
 */
function stringSimilarity(a, b) {
    const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
    const maxLen = Math.max(a.length, b.length);
    return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}
/**
 * Find similar strings from a list
 * Returns matches above threshold, sorted by similarity
 */
function findSimilar(input, available, threshold = 0.5) {
    return available
        .map(value => ({
        value,
        score: stringSimilarity(input, value)
    }))
        .filter(x => x.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3); // Top 3 suggestions
}
/**
 * Build a helpful error message for column not found
 */
function buildColumnNotFoundError(columnName, availableColumns) {
    const suggestions = findSimilar(columnName, availableColumns);
    let message = `Column '${columnName}' not found`;
    if (suggestions.length > 0) {
        message += `\n\nDid you mean:`;
        suggestions.forEach(({ value, score }) => {
            const percentage = Math.round(score * 100);
            message += `\n  • ${value} (${percentage}% match)`;
        });
    }
    message += `\n\nAvailable columns: ${availableColumns.join(', ')}`;
    message += `\n\nTip: Column names are case-sensitive`;
    return message;
}
