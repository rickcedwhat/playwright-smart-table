import type { Locator, Page } from '@playwright/test';
import { SmartRow as SmartRowType, FillOptions, FinalTableConfig, TableResult } from './types';
import { FillStrategies } from './strategies/fill';

/**
 * Factory to create a SmartRow by extending a Playwright Locator.
 * We avoid Class/Proxy to ensure full compatibility with Playwright's expect(locator) matchers.
 */
export const createSmartRow = <T = any>(
    rowLocator: Locator,
    map: Map<string, number>,
    rowIndex: number | undefined,
    config: FinalTableConfig,
    rootLocator: Locator,
    resolve: (item: any, parent: Locator | Page) => Locator,
    table: TableResult<T> | null
): SmartRowType<T> => {
    const smart = rowLocator as unknown as SmartRowType<T>;

    // Attach State
    smart.rowIndex = rowIndex;
    smart.getRequestIndex = () => rowIndex;

    // Attach Methods
    smart.getCell = (colName: string): Locator => {
        const idx = map.get(colName);
        if (idx === undefined) {
            const availableColumns = Array.from(map.keys());
            throw new Error(`Column "${colName}" not found. Available: ${availableColumns.join(', ')}`);
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
        const result: Record<string, string> = {};
        const page = rootLocator.page();

        for (const [col, idx] of map.entries()) {
            if (options?.columns && !options.columns.includes(col)) {
                continue;
            }

            // Get the cell locator
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

            // Check if cell exists
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
                        if (config.debug) console.log(`[SmartRow] Already at target cell (r:${active.rowIndex}, c:${active.columnIndex}), skipping navigation.`);
                        targetCell = active.locator;
                        // Skip navigation and go to reading text
                        const text = await targetCell.innerText();
                        result[col] = (text || '').trim();
                        continue;
                    }
                }

                // Cell doesn't exist - navigate to it
                if (config.debug) {
                    console.log(`[SmartRow.toJSON] Cell not found for column "${col}" (index ${idx}), navigating...`);
                }

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



                // Optimization: check if we can get the active cell directly
                if (config.strategies.getActiveCell) {
                    const activeCell = await config.strategies.getActiveCell({
                        config,
                        root: rootLocator,
                        page,
                        resolve
                    });

                    if (activeCell) {
                        if (config.debug) {
                            console.log(`[SmartRow.toJSON] switching to active cell locator (r:${activeCell.rowIndex}, c:${activeCell.columnIndex})`);
                        }
                        targetCell = activeCell.locator;
                    }
                }
            }

            const text = await targetCell.innerText();
            result[col] = (text || '').trim();
        }
        return result as unknown as T;
    };

    // @ts-ignore
    smart.fill = async (data: Record<string, any>, fillOptions?: FillOptions): Promise<void> => {
        for (const [colName, value] of Object.entries(data)) {
            const colIdx = map.get(colName);
            if (colIdx === undefined) {
                throw new Error(`Column "${colName}" not found in fill data.`);
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
        }
    };

    smart.bringIntoView = async (): Promise<void> => {
        if (rowIndex === undefined) {
            throw new Error('Cannot bring row into view - row index is unknown. Use getByRowIndex() instead of getByRow().');
        }

        // Scroll row into view using Playwright's built-in method
        await rowLocator.scrollIntoViewIfNeeded();
    };

    smart.smartFill = smart.fill;

    return smart;
};
