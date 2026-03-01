import type { Locator, Page } from '@playwright/test';
import { SmartRow as SmartRowType, FillOptions, FinalTableConfig, TableResult } from './types';
import { FillStrategies } from './strategies/fill';
import { buildColumnNotFoundError } from './utils/stringUtils';
import { debugDelay, logDebug } from './utils/debugUtils';
import { planNavigationPath, executeNavigationPath, executeNavigationWithGoToPageRetry } from './utils/paginationPath';
import { SENTINEL_ROW } from './utils/sentinel';

type StrategyContext = {
    config: FinalTableConfig<any>;
    root: Locator;
    page: Page;
    resolve: (item: any, parent: Locator | Page) => Locator;
};

/**
 * Internal helper to navigate to a cell with active cell optimization.
 * Uses navigation primitives (goUp, goDown, goLeft, goRight, goHome) for orchestration.
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

        // Wait for active cell to match target: poll getActiveCell or fallback to fixed delay
        if (config.strategies.getActiveCell) {
            const pollIntervalMs = 10;
            const maxWaitMs = 50;
            const start = Date.now();
            while (Date.now() - start < maxWaitMs) {
                const updatedActiveCell = await config.strategies.getActiveCell({
                    config,
                    root: rootLocator,
                    page,
                    resolve
                });
                if (updatedActiveCell && updatedActiveCell.rowIndex === rowIndex && updatedActiveCell.columnIndex === index) {
                    return updatedActiveCell.locator;
                }
                await page.waitForTimeout(pollIntervalMs);
            }
            const final = await config.strategies.getActiveCell({
                config,
                root: rootLocator,
                page,
                resolve
            });
            if (final) return final.locator;
            return null;
        }

        return null;
    }
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

    smart.wasFound = (): boolean => {
        return !(smart as any)[SENTINEL_ROW];
    };

    smart.toJSON = async (options?: { columns?: string[] }): Promise<T> => {
        const result: Record<string, any> = {};
        const page = rootLocator.page();

        // Build a getHeaderCell helper for the beforeCellRead context.
        // Uses the table reference if available, otherwise falls back to index-based lookup.
        const getHeaderCell = table?.getHeaderCell
            ? table.getHeaderCell.bind(table)
            : async (colName: string) => {
                const idx = map.get(colName);
                if (idx === undefined) throw new Error(`Column "${colName}" not found`);
                return resolve(config.headerSelector as any, rootLocator).nth(idx);
            };

        for (const [col, idx] of map.entries()) {
            if (options?.columns && !options.columns.includes(col)) {
                continue;
            }

            // Check if we have a column override for this column
            const columnOverride = config.columnOverrides?.[col as keyof T];
            const mapper = columnOverride?.read;

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

            // Call beforeCellRead hook if configured.
            // Fires for BOTH columnOverrides.read and the default innerText path.
            if (config.strategies.beforeCellRead) {
                await config.strategies.beforeCellRead({
                    cell: targetCell,
                    columnName: col,
                    columnIndex: idx,
                    row: rowLocator,
                    page,
                    root: rootLocator,
                    getHeaderCell,
                });
            }

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

            const columnOverride = config.columnOverrides?.[colName as keyof T];
            if (columnOverride?.write) {
                const cellLocator = smart.getCell(colName);

                let currentValue;
                if (columnOverride.read) {
                    currentValue = await columnOverride.read(cellLocator);
                }

                await columnOverride.write({
                    cell: cellLocator,
                    targetValue: value,
                    currentValue,
                    row: smart
                });
            } else {
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
                    table: table as TableResult<T>,
                    fillOptions
                });
            }

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

        // Cross-page Navigation: when goToPage exists use retry loop (supports windowed UIs); otherwise use path planner or goToFirst+goNext
        if (tablePageIndex !== undefined && config.strategies.pagination) {
            const primitives = config.strategies.pagination as import('./types').PaginationPrimitives;
            const context = { root: rootLocator, config, page: rootLocator.page(), resolve };
            const getCurrent = () => parentTable.currentPageIndex;
            const setCurrent = (n: number) => { parentTable.currentPageIndex = n; };

            if (primitives.goToPage) {
                logDebug(config, 'info', `bringIntoView: Navigating to page ${tablePageIndex} (goToPage retry loop)`);
                await executeNavigationWithGoToPageRetry(tablePageIndex, primitives, context, getCurrent, setCurrent);
            } else {
                const path = planNavigationPath(getCurrent(), tablePageIndex, primitives);
                if (path.length > 0) {
                    logDebug(config, 'info', `bringIntoView: Executing navigation path to page ${tablePageIndex} (${path.length} step(s))`);
                    await executeNavigationPath(path, primitives, context, getCurrent, setCurrent);
                } else if (primitives.goToFirst && primitives.goNext && tablePageIndex >= 0) {
                    logDebug(config, 'info', `bringIntoView: going to first page and looping goNext until we reach page ${tablePageIndex}`);
                    await primitives.goToFirst(context);
                    for (let i = 0; i < tablePageIndex; i++) {
                        const ok = await primitives.goNext(context);
                        if (!ok) throw new Error(`bringIntoView: goNext failed before reaching page ${tablePageIndex}.`);
                    }
                    parentTable.currentPageIndex = tablePageIndex;
                } else {
                    logDebug(config, 'error', `Cannot bring row on page ${tablePageIndex} into view. No backwards pagination strategies (goToPage, goPrevious, goPreviousBulk, or goToFirst+goNext) provided.`);
                    throw new Error(`Cannot bring row on page ${tablePageIndex} into view: Row is on a different page and no backward pagination primitive found.`);
                }
            }
        }

        // Delay after pagination/finding before scrolling
        await debugDelay(config, 'findRow');

        // Scroll row into view using Playwright's built-in method
        await rowLocator.scrollIntoViewIfNeeded();
    };

    return smart;
};

