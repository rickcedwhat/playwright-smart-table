import { describe, it, expect } from 'vitest';
import { validatePaginationResult, validateSortingStrategy, validateFillStrategy } from '../../src/strategies/validation';

describe('validatePaginationResult', () => {
  it('returns true for boolean true', () => {
    expect(validatePaginationResult(true)).toBe(true);
  });

  it('returns false for boolean false', () => {
    expect(validatePaginationResult(false)).toBe(false);
  });

  it('returns true for positive number (pages jumped)', () => {
    expect(validatePaginationResult(1)).toBe(true);
    expect(validatePaginationResult(5)).toBe(true);
    expect(validatePaginationResult(10)).toBe(true);
  });

  it('returns false for number 0', () => {
    expect(validatePaginationResult(0)).toBe(false);
  });

  it('throws for invalid types', () => {
    expect(() => validatePaginationResult(undefined)).toThrow(
      /Pagination strategy must return a boolean.*or a number/
    );
    expect(() => validatePaginationResult(null)).toThrow(
      /Pagination strategy must return/
    );
    expect(() => validatePaginationResult('true')).toThrow(
      /Received: string/
    );
    expect(() => validatePaginationResult({})).toThrow(
      /Received: object/
    );
  });

  it('uses strategy name in error message', () => {
    expect(() => validatePaginationResult(undefined, 'MyStrategy')).toThrow(
      /\[MyStrategy\]/
    );
  });
});

describe('validateSortingStrategy', () => {
  it('throws for non-object', () => {
    expect(() => validateSortingStrategy(null as any)).toThrow();
  });
  it('throws when doSort missing', () => {
    expect(() => validateSortingStrategy({ getSortState: () => 'none' } as any)).toThrow();
  });
  it('throws when getSortState missing', () => {
    expect(() => validateSortingStrategy({ doSort: async () => {} } as any)).toThrow();
  });
  it('returns true for valid strategy', () => {
    const s = { doSort: async () => {}, getSortState: async () => 'none' };
    expect(validateSortingStrategy(s as any)).toBe(true);
  });
});

describe('validateFillStrategy', () => {
  it('throws when not a function', () => {
    expect(() => validateFillStrategy({} as any)).toThrow();
  });
  it('returns true for function', () => {
    expect(validateFillStrategy(() => {})).toBe(true);
  });
});
