import type { Locator, Page } from '@playwright/test';
import { SmartRow as SmartRowType, FillOptions, FinalTableConfig, TableResult } from './types';
import { FillStrategies } from './strategies/fill';
import { buildColumnNotFoundError } from './utils/stringUtils';
import { debugDelay, logDebug } from './utils/debugUtils';

/**
 * Factory to create a SmartRow by extending a Playwright Locator.
 * We avoid Class/Proxy to ensure full compatibility with Playwright's expect(locator) matchers.
 */
export const createSmartRow = <T = any>(
    rowLocator: Locator,
    map: Map<string, number>,
    rowIndex: number | undefined,
    config: FinalTableConfig<T>,
    rootLocator: Locator,
    resolve: (item: any, parent: Locator | Page) => Locator,
    table: TableResult<T> | null
): SmartRowType<T> => {
    const smart = rowLocator as unknown as SmartRowType<T>;

    // Attach State
    smart.rowIndex = rowIndex;

    // Attach Methods
    smart.getCell = (colName: string): Locator => {
        const idx = map.get(colName);
        if (idx === undefined) {
            throw new Error(buildColumnNotFoundError(colName, Array.from(map.keys())));
        }

        if (config.strategies.getCellLocator) {
            return config.strategies.getCellLocator({
                row: rowLocator,
                columnName: colName,
                columnIndex: idx,
                rowIndex: rowIndex,
                page: rootLocator.page()
            });
        }

        return resolve(config.cellSelector, rowLocator).nth(idx);
    };

    smart.toJSON = async (options?: { columns?: string[] }): Promise<T> => {
        const result: Record<string, any> = {};
        const page = rootLocator.page();

        for (const [col, idx] of map.entries()) {
            if (options?.columns && !options.columns.includes(col)) {
                continue;
            }

            // Check if we have a data mapper for this column
            const mapper = config.dataMapper?.[col as keyof T];

            if (mapper) {
                // Use custom mapper
                // Ensure we have the cell first (same navigation logic)
                // ... wait, the navigation logic below assumes we need to navigate.
                // If we have a mapper, we still need the cell locator.

                // Let's reuse the navigation logic to get targetCell
            }

            // --- Navigation Logic Start ---
            const cell = config.strategies.getCellLocator
                ? config.strategies.getCellLocator({
                    row: rowLocator,
                    columnName: col,
                    columnIndex: idx,
                    rowIndex: rowIndex,
                    page: page
                })
                : resolve(config.cellSelector, rowLocator).nth(idx);

            let targetCell = cell;
            const count = await cell.count();

            if (count === 0) {
                // Optimization: Check if we are ALREADY at the target cell
                if (config.strategies.getActiveCell) {
                    const active = await config.strategies.getActiveCell({
                        config,
                        root: rootLocator,
                        page,
                        resolve
                    });
                    if (active && active.rowIndex === rowIndex && active.columnIndex === idx) {
                        targetCell = active.locator;
                        // Skip navigation
                    } else {
                        // Cell doesn't exist - navigate to it
                        await config.strategies.cellNavigation!({
                            config: config,
                            root: rootLocator,
                            page: page,
                            resolve: resolve,
                            column: col,
                            index: idx,
                            rowLocator: rowLocator,
                            rowIndex: rowIndex
                        });
                        // Update targetCell after navigation if needed (e.g. active cell changed)
                        if (config.strategies.getActiveCell) {
                            const activeCell = await config.strategies.getActiveCell({
                                config,
                                root: rootLocator,
                                page,
                                resolve
                            });
                            if (activeCell) targetCell = activeCell.locator;
                        }
                    }
                } else {
                    // Fallback navigation without active cell check
                    await config.strategies.cellNavigation!({
                        config: config,
                        root: rootLocator,
                        page: page,
                        resolve: resolve,
                        column: col,
                        index: idx,
                        rowLocator: rowLocator,
                        rowIndex: rowIndex
                    });
                }
            }
            // --- Navigation Logic End ---

            if (mapper) {
                // Apply mapper
                const mappedValue = await mapper(targetCell);
                result[col] = mappedValue;
            } else {
                // Default string extraction
                const text = await targetCell.innerText();
                result[col] = (text || '').trim();
            }
        }
        return result as unknown as T;
    };

    smart.smartFill = async (data: Partial<T> | Record<string, any>, fillOptions?: FillOptions): Promise<void> => {
        logDebug(config, 'info', 'Filling row', data);

        for (const [colName, value] of Object.entries(data)) {
            if (value === undefined) continue;

            const colIdx = map.get(colName);
            if (colIdx === undefined) {
                throw new Error(buildColumnNotFoundError(colName, Array.from(map.keys())));
            }

            await config.strategies.cellNavigation!({
                config: config,
                root: rootLocator,
                page: rootLocator.page(),
                resolve: resolve,
                column: colName,
                index: colIdx,
                rowLocator: rowLocator,
                rowIndex: rowIndex
            });

            const strategy = config.strategies.fill || FillStrategies.default;

            logDebug(config, 'verbose', `Filling cell "${colName}" with value`, value);

            await strategy({
                row: smart,
                columnName: colName,
                value,
                index: rowIndex ?? -1,
                page: rowLocator.page(),
                rootLocator,
                table: table as TableResult,
                fillOptions
            });

            // Delay after filling
            await debugDelay(config, 'getCell');
        }

        logDebug(config, 'info', 'Row fill complete');
    };

    smart.bringIntoView = async (): Promise<void> => {
        if (rowIndex === undefined) {
            throw new Error('Cannot bring row into view - row index is unknown. Use getRowByIndex() instead of getRow().');
        }

        // Scroll row into view using Playwright's built-in method
        await rowLocator.scrollIntoViewIfNeeded();
    };

    return smart;
};
