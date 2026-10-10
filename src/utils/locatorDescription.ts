import type { Locator } from '@playwright/test';
import type { FilterValue, FinalTableConfig } from '../types';
import { logDebug } from './debugUtils';

const MAX_VALUE_LENGTH = 40;
const locatorDescriptions = new WeakMap<Locator, string>();
let loggedUnsupported = false;

const formatFilterValue = (value: FilterValue): string => {
    if (value instanceof RegExp) return value.toString();
    if (typeof value === 'function') return '<locator filter>';
    if (typeof value === 'number') return String(value);
    const text = value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
    return JSON.stringify(text);
};

/** `Name="Alice", Status=/act/i` — readable in traces, unlike JSON.stringify (which turns RegExp into `{}`). */
export const formatFilters = (filters: Record<string, FilterValue>): string =>
    Object.entries(filters).map(([col, value]) => `${col}=${formatFilterValue(value)}`).join(', ');

export const describeRowByFilters = (filters: Record<string, FilterValue>): string => {
    const formatted = formatFilters(filters);
    return formatted ? `SmartRow where ${formatted}` : 'SmartRow';
};

/** `SmartRow #3`, or `SmartRow #3 where Dept="Eng"` when the row came from a filtered search. */
export const describeRowByIndex = (rowIndex: number, filters: Record<string, FilterValue> = {}): string => {
    const formatted = formatFilters(filters);
    return formatted ? `SmartRow #${rowIndex} where ${formatted}` : `SmartRow #${rowIndex}`;
};

export const describeSentinelRow = (filters: Record<string, FilterValue>): string => {
    const formatted = formatFilters(filters);
    return formatted ? `SmartRow not found: ${formatted}` : 'SmartRow not found';
};

/**
 * Applies `locator.describe()` (Playwright 1.53+) so traces, HTML reports and error messages show a
 * readable name instead of the raw selector chain. Older Playwright versions get the locator back unchanged.
 */
export const describeLocator = (locator: Locator, description: string, config?: FinalTableConfig): Locator => {
    if (typeof locator.describe === 'function') {
        const described = locator.describe(description);
        locatorDescriptions.set(described, description);
        return described;
    }
    if (config?.debug && !loggedUnsupported) {
        loggedUnsupported = true;
        logDebug(config, 'info', 'Upgrade @playwright/test to 1.53+ to see SmartRow / SmartCell names in traces and error messages');
    }
    return locator;
};

/** The description already applied to a locator, or undefined (unsupported or never described). */
export const getLocatorDescription = (locator: Locator): string | undefined =>
    typeof locator.description === 'function' ? locator.description() ?? undefined : locatorDescriptions.get(locator);
