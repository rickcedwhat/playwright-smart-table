import type { Locator, Page } from '@playwright/test';
import { SmartRow as SmartRowType, FillOptions, FinalTableConfig, TableResult } from './types';
import { FillStrategies } from './strategies/fill';
import { buildColumnNotFoundError } from './utils/stringUtils';
import { debugDelay, logDebug } from './utils/debugUtils';

type StrategyContext = {
    config: FinalTableConfig<any>;
    root: Locator;
    page: Page;
    resolve: (item: any, parent: Locator | Page) => Locator;
};

/**
 * Internal helper to navigate to a cell with active cell optimization.
 * Uses navigation primitives (goUp, goDown, goLeft, goRight, goHome) for orchestration.
 * Falls back to cellNavigation for backward compatibility.
 * Returns the target cell locator after navigation.
 */
const _navigateToCell = async (params: {
    config: FinalTableConfig<any>;
    rootLocator: Locator;
    page: Page;
    resolve: (item: any, parent: Locator | Page) => Locator;
    column: string;
    index: number;
    rowLocator: Locator;
    rowIndex?: number;
}): Promise<Locator | null> => {
    const { config, rootLocator, page, resolve, column, index, rowLocator, rowIndex } = params;

    // Get active cell if strategy is available
    let activeCell = null;
    if (config.strategies.getActiveCell) {
        activeCell = await config.strategies.getActiveCell({
            config,
            root: rootLocator,
            page,
            resolve
        });

        // Optimization: Check if we are ALREADY at the target cell
        if (activeCell && activeCell.rowIndex === rowIndex && activeCell.columnIndex === index) {
            // Skip navigation - we're already there!
            return activeCell.locator;
        }
    }

    const context: StrategyContext = { config, root: rootLocator, page, resolve };

    // Use navigation primitives if available
    if (config.strategies.navigation) {
        const nav = config.strategies.navigation;

        if (typeof rowIndex !== 'number') {
            throw new Error('Row index is required for navigation');
        }

        // Determine starting position
        let startRow = 0;
        let startCol = 0;

        if (activeCell && activeCell.rowIndex >= 0 && activeCell.columnIndex >= 0) {
            // Use current position
            startRow = activeCell.rowIndex;
            startCol = activeCell.columnIndex;
        } else if (nav.goHome) {
            // Reset to top-left
            await nav.goHome(context);
        }

        // Calculate movement needed
        const rowDiff = rowIndex - startRow;
        const colDiff = index - startCol;

        // Navigate vertically
        for (let i = 0; i < Math.abs(rowDiff); i++) {
            if (rowDiff > 0 && nav.goDown) {
                await nav.goDown(context);
            } else if (rowDiff < 0 && nav.goUp) {
                await nav.goUp(context);
            }
        }

        // Navigate horizontally
        for (let i = 0; i < Math.abs(colDiff); i++) {
            if (colDiff > 0 && nav.goRight) {
                await nav.goRight(context);
            } else if (colDiff < 0 && nav.goLeft) {
                await nav.goLeft(context);
            }
        }

        await page.waitForTimeout(50);


        // Get the active cell locator after navigation (for virtualized tables)
        if (config.strategies.getActiveCell) {
            const updatedActiveCell = await config.strategies.getActiveCell({
                config,
                root: rootLocator,
                page,
                resolve
            });
            if (updatedActiveCell) {
                return updatedActiveCell.locator;
            }
        }

        return null;
    };
    return null;
};

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
    table: TableResult<T> | null,
    tablePageIndex?: number
): SmartRowType<T> => {
    const smart = rowLocator as unknown as SmartRowType<T>;

    // Attach State
    smart.rowIndex = rowIndex;
    smart.tablePageIndex = tablePageIndex;
    smart.table = table as any;

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

            // Check if we have a column override or data mapper for this column
            const columnOverride = config.columnOverrides?.[col as keyof T];
            const mapper = columnOverride?.read || config.dataMapper?.[col as keyof T];

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
                // Cell not in DOM (virtualized) - navigate to it
                const navigatedCell = await _navigateToCell({
                    config,
                    rootLocator,
                    page,
                    resolve,
                    column: col,
                    index: idx,
                    rowLocator,
                    rowIndex
                });

                if (navigatedCell) {
                    targetCell = navigatedCell;
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

            await _navigateToCell({
                config,
                rootLocator,
                page: rootLocator.page(),
                resolve,
                column: colName,
                index: colIdx,
                rowLocator,
                rowIndex
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
                config,
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

        const parentTable = smart.table as TableResult<T>;

        // Cross-page Navigation using PaginationPrimitives
        if (tablePageIndex !== undefined && config.strategies.pagination) {
            const primitives = config.strategies.pagination as import('./types').PaginationPrimitives;
            // Only orchestrate if it's an object of primitives, not a single function
            if (typeof config.strategies.pagination !== 'function') {
                const context = { root: rootLocator, config, page: rootLocator.page(), resolve };

                if (primitives.goToPage) {
                    logDebug(config, 'info', `bringIntoView: Jumping to page ${tablePageIndex} using goToPage primitive`);
                    await primitives.goToPage(tablePageIndex, context);
                } else if (primitives.goPrevious) {
                    logDebug(config, 'info', `bringIntoView: Looping goPrevious until we reach page ${tablePageIndex}`);
                    const diff = parentTable.currentPageIndex - tablePageIndex;
                    for (let i = 0; i < diff; i++) {
                        const success = await primitives.goPrevious(context);
                        if (!success) {
                            throw new Error(`bringIntoView: Failed to paginate backwards. Strategy aborted before reaching page ${tablePageIndex}.`);
                        }
                    }
                } else if (primitives.goToFirst && primitives.goNext) {
                    logDebug(config, 'info', `bringIntoView: going to first page and looping goNext until we reach page ${tablePageIndex}`);
                    await primitives.goToFirst(context);
                    for (let i = 0; i < tablePageIndex; i++) {
                        await primitives.goNext(context);
                    }
                } else {
                    logDebug(config, 'error', `Cannot bring row on page ${tablePageIndex} into view. No backwards pagination strategies (goToPage, goPrevious, or goToFirst) provided.`);
                    throw new Error(`Cannot bring row on page ${tablePageIndex} into view: Row is on a different page and no backward pagination primitive found.`);
                }
            } else {
                throw new Error(`Cannot bring row on page ${tablePageIndex} into view: Pagination is a single function. Provide an object with 'goPrevious', 'goToPage', or 'goToFirst' primitives.`);
            }

            // Successfully orchestrated backwards navigation, now update the state pointer
            parentTable.currentPageIndex = tablePageIndex;
        }

        // Delay after pagination/finding before scrolling
        await debugDelay(config, 'findRow');

        // Scroll row into view using Playwright's built-in method
        await rowLocator.scrollIntoViewIfNeeded();
    };

    return smart;
};

