import { describe, it, expect, vi } from 'vitest';
import type { Locator } from '@playwright/test';
import { describeLocator, describeRowByFilters, describeSentinelRow, formatFilters, getLocatorDescription } from '../../src/utils/locatorDescription';

describe('locatorDescription (#485)', () => {
  it('formats strings, numbers, regexes and locator filters readably', () => {
    const text = formatFilters({ Name: 'Alice', Age: 30, Status: /act/i, Email: (cell: Locator) => cell });

    expect(text).toBe('Name="Alice", Age=30, Status=/act/i, Email=<locator filter>');
  });

  it('truncates long string values', () => {
    const text = formatFilters({ Notes: 'x'.repeat(60) });

    expect(text).toBe(`Notes="${'x'.repeat(40)}…"`);
  });

  it('names rows with no filters plainly', () => {
    expect(describeRowByFilters({})).toBe('SmartRow');
    expect(describeSentinelRow({})).toBe('SmartRow not found');
  });

  it('returns the same locator when describe() is unavailable (Playwright < 1.53)', () => {
    const legacyLocator = {} as Locator;

    const result = describeLocator(legacyLocator, 'SmartRow #1');

    expect(result).toBe(legacyLocator);
    expect(getLocatorDescription(legacyLocator)).toBeUndefined();
  });

  it('delegates to describe() when available', () => {
    const described = {} as Locator;
    const locator = { describe: vi.fn(() => described) } as unknown as Locator;

    const result = describeLocator(locator, 'SmartRow #1');

    expect(locator.describe).toHaveBeenCalledWith('SmartRow #1');
    expect(result).toBe(described);
  });
});
