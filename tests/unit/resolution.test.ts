import { describe, it, expect } from 'vitest';
import { ResolutionStrategies } from '../../src/strategies/resolution';
import { StrategyContext } from '../../src/types';

describe('Resolution Strategies', () => {
    const headerMap = new Map<string, number>([
        ['ID', 0],
        ['First Name', 1],
        ['Last Name', 2],
        ['Email', 3],
        ['Status', 4],
        ['Created At', 5]
    ]);

    // Mock context (not used by default strategy but required by type)
    const mockContext = {} as StrategyContext;

    describe('default.resolveIndex', () => {
        const resolve = ResolutionStrategies.default.resolveIndex;

        it('should resolve by exact string match', () => {
            expect(resolve({ query: 'ID', headerMap, context: mockContext })).toBe(0);
            expect(resolve({ query: 'Email', headerMap, context: mockContext })).toBe(3);
        });

        it('should return undefined for non-existent string', () => {
            expect(resolve({ query: 'Phone', headerMap, context: mockContext })).toBeUndefined();
        });

        it('should resolve by regex match', () => {
            expect(resolve({ query: /First/, headerMap, context: mockContext })).toBe(1);
            expect(resolve({ query: /^Last/, headerMap, context: mockContext })).toBe(2);
            expect(resolve({ query: /at/i, headerMap, context: mockContext })).toBe(4); // "Status" has 'at', wait... Status doesn't have at. 'Created At' has 'at'. Status has 'at' inside 'St(at)us'.
        });

        it('should return undefined for non-matching regex', () => {
            expect(resolve({ query: /^Z/, headerMap, context: mockContext })).toBeUndefined();
        });

        it('should handle case sensitivity in regex', () => {
            expect(resolve({ query: /first name/, headerMap, context: mockContext })).toBeUndefined();
            expect(resolve({ query: /first name/i, headerMap, context: mockContext })).toBe(1);
        });
    });

    describe('default.resolveName', () => {
        const resolveName = ResolutionStrategies.default.resolveName;

        it('should return string query as-is', () => {
            expect(resolveName({ query: 'ID', headerMap })).toBe('ID');
        });

        it('should return regex query as string', () => {
            const regex = /test/;
            expect(resolveName({ query: regex, headerMap })).toBe('/test/');
        });
    });
});
