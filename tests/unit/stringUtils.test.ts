import { describe, it, expect } from 'vitest';
import { levenshteinDistance, stringSimilarity, findSimilar, buildColumnNotFoundError } from '../../src/utils/stringUtils';

describe('String Utils', () => {
    describe('levenshteinDistance', () => {
        it('should return 0 for identical strings', () => {
            expect(levenshteinDistance('abc', 'abc')).toBe(0);
        });

        it('should calculate distance correctly', () => {
            expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
            expect(levenshteinDistance('flaw', 'lawn')).toBe(2);
        });

        it('should return 0.1 for case mismatch', () => {
            expect(levenshteinDistance('Abc', 'abc')).toBeCloseTo(0.1);
        });
    });

    describe('stringSimilarity', () => {
        it('should return very high score for case mismatch (weight 0.1)', () => {
            // 'Abc' vs 'abc' -> distance 0.1, maxLen 3 -> 1 - (0.1/3) = 0.9666...
            expect(stringSimilarity('Abc', 'abc')).toBeCloseTo(0.967, 3);
        });

        it('should return high score for all-caps mismatch', () => {
            // 'ABC' vs 'abc' -> distance 0.3 (3 * 0.1), maxLen 3 -> 1 - (0.3/3) = 0.9
            expect(stringSimilarity('ABC', 'abc')).toBeCloseTo(0.9, 3);
        });

        it('should return 0 for completely different strings', () => {
            // "abc" vs "def" -> distance 3, maxLen 3 -> 1 - 3/3 = 0
            expect(stringSimilarity('abc', 'def')).toBe(0);
        });

        it('should return a score between 0 and 1', () => {
            const score = stringSimilarity('hello', 'hullo');
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThan(1);
        });
    });

    describe('findSimilar', () => {
        const available = ['First Name', 'Last Name', 'Email Address', 'Phone Number', 'Status'];

        it('should find exact match', () => {
            const results = findSimilar('First Name', available);
            expect(results[0].value).toBe('First Name');
            expect(results[0].score).toBe(1);
        });

        it('should find close match', () => {
            const results = findSimilar('firstname', available);
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].value).toBe('First Name');
        });

        it('should return empty if no similar strings found', () => {
            const results = findSimilar('Xylophone', available);
            expect(results).toHaveLength(0);
        });
    });

    describe('buildColumnNotFoundError', () => {
        const available = ['First Name', 'Last Name', 'Email'];

        it('should include the missing column name', () => {
            const msg = buildColumnNotFoundError('Fist Name', available);
            expect(msg).toContain("Column 'Fist Name' not found");
        });

        it('should suggest similar columns', () => {
            const msg = buildColumnNotFoundError('Fist Name', available);
            expect(msg).toContain('Did you mean:');
            expect(msg).toContain('First Name');
        });

        it('should list available columns', () => {
            const msg = buildColumnNotFoundError('Random', available);
            expect(msg).toContain('Available columns: First Name, Last Name, Email');
        });
    });
});
