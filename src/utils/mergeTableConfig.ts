import type { TableConfig } from '../types';

/**
 * Deep-merges two `TableConfig` objects.
 *
 * Merge semantics:
 * - Top-level keys (`rowSelector`, `maxPages`, etc.): overrides win — same as `{ ...base, ...overrides }`.
 * - `strategies`: each sub-key is merged independently. Strategy sub-objects (`loading`, `viewport`)
 *   are merged key-by-key so that neither side silently wipes the other's settings.
 *   Function-valued strategies (`pagination`, `header`, `dedupe`, `getCellLocator`, etc.) are
 *   replaced in full by the override value (a function cannot be meaningfully object-spread).
 * - `columnOverrides`: merged key-by-key (each column entry merged independently).
 * - Everything else: overrides win (shallow merge).
 *
 * @example
 * const config = mergeTableConfig(baseConfig, {
 *   maxPages: 20,
 *   strategies: {
 *     loading: { isTableLoading: myLoadingFn },
 *   },
 * });
 */
export function mergeTableConfig<T = any>(
    base: TableConfig<T>,
    overrides: TableConfig<T>
): TableConfig<T> {
    const result: TableConfig<T> = { ...base, ...overrides };

    // Deep-merge strategies one level down
    if (base.strategies || overrides.strategies) {
        result.strategies = {
            ...base.strategies,
            ...overrides.strategies,
        };

        // For strategy sub-keys that are plain objects on *both* sides, merge key-by-key
        // so that e.g. base.strategies.loading and overrides.strategies.loading are combined.
        // Function values (pagination, header, dedupe, getCellLocator, etc.) are replaced, not merged.
        const strategyKeys = new Set([
            ...Object.keys(base.strategies ?? {}),
            ...Object.keys(overrides.strategies ?? {}),
        ]) as Set<keyof NonNullable<TableConfig<T>['strategies']>>;

        for (const key of strategyKeys) {
            const baseVal = base.strategies?.[key];
            const overrideVal = overrides.strategies?.[key];
            if (
                baseVal !== undefined &&
                overrideVal !== undefined &&
                typeof baseVal === 'object' &&
                typeof overrideVal === 'object' &&
                !Array.isArray(baseVal) &&
                !Array.isArray(overrideVal) &&
                typeof baseVal !== 'function' &&
                typeof overrideVal !== 'function'
            ) {
                (result.strategies as any)[key] = { ...baseVal, ...overrideVal };
            }
        }
    }

    // Deep-merge columnOverrides one level down (each column entry merged independently)
    if (base.columnOverrides || overrides.columnOverrides) {
        result.columnOverrides = {
            ...base.columnOverrides,
            ...overrides.columnOverrides,
        } as TableConfig<T>['columnOverrides'];
    }

    return result;
}
