import type { Locator, Page } from '@playwright/test';
import { SmartRow as SmartRowType, FillOptions, FinalTableConfig, TableResult, SmartCell } from './types';
import { FillStrategies } from './strategies/fill';
import { buildColumnNotFoundError } from './utils/stringUtils';
import { debugDelay, logDebug } from './utils/debugUtils';
import { planNavigationPath, executeNavigationPath, executeNavigationWithGoToPageRetry } from './utils/paginationPath';
import { SENTINEL_ROW } from './utils/sentinel';
import { NavigationBarrier } from './utils/navigationBarrier';

type StrategyContext = {
    config: FinalTableConfig<any>;
    root: Locator;
    page: Page;
    resolve: (item: any, parent: Locator | Page) => Locator;
};

/**
 * Internal helper to navigate to a cell with active cell optimization.
 * Uses `strategies.navigation` primitives (goUp/goDown/goLeft/goRight, optional snap/seek/goHome).
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
    barrier?: NavigationBarrier;
}): Promise<Locator> => {
    const { config, rootLocator, page, resolve, column, index, rowLocator, rowIndex, barrier } = params;
    const rowLabel = typeof rowIndex === 'number' ? `row ${rowIndex}` : 'row ?';
    logDebug(
        config,
        'verbose',
        `_navigateToCell: resolving column "${column}" (colIndex ${index}), ${rowLabel}`,
    );

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
            logDebug(config, 'verbose', `_navigateToCell: Already at target cell {row: ${rowIndex}, col: ${index}}`);
            return activeCell.locator;
        }
    }

    const context: StrategyContext = { config, root: rootLocator, page, resolve };

    // Shared helper: is the target cell currently in the DOM?
    const targetReached = async () => {
        if (config.strategies.getActiveCell) {
            const ac = await config.strategies.getActiveCell({ config, root: rootLocator, page, resolve });
            if (ac && ac.rowIndex === rowIndex && ac.columnIndex === index) return true;
        }
        // Locator presence: virtualized grids (e.g. Glide) often attach the target `td` after scroll
        // while focus id lags; do not require getActiveCell to match for this to count as reached.
        const cell = config.strategies.getCellLocator
            ? config.strategies.getCellLocator({ row: rowLocator, root: rootLocator, columnName: column, columnIndex: index, rowIndex, page, config })
            : resolve(config.cellSelector, rowLocator).nth(index);
        return (await cell.count() > 0);
    };

    const getCellLocator = () => config.strategies.getCellLocator
        ? config.strategies.getCellLocator({ row: rowLocator, root: rootLocator, columnName: column, columnIndex: index, rowIndex, page, config })
        : resolve(config.cellSelector, rowLocator).nth(index);

    // Viewport-oracle phase: direct positioning for 2D virtualized tables.
    // Runs before navigation primitives; falls through to them if cell still not accessible.
    const viewport = config.strategies.viewport;
    if (viewport && typeof rowIndex === 'number') {
        // Fast path via range oracle: if the user provides getVisibleColumnRange (and memoizes it),
        // this check is a near-instant JS lookup — no DOM count() round-trip needed.
        // Rows do NOT sync at the barrier here — only scroll boundaries need coordination.
        if (viewport.getVisibleColumnRange) {
            const colRange = await viewport.getVisibleColumnRange(context);
            if (colRange && index >= colRange.first && index <= colRange.last) {
                const rowRange = viewport.getVisibleRowRange
                    ? await viewport.getVisibleRowRange(context)
                    : null;
                const rowVisible = !rowRange || (rowIndex >= rowRange.first && rowIndex <= rowRange.last);
                if (rowVisible && await targetReached()) {
                    logDebug(config, 'verbose', `_navigateToCell: col ${index} in visible range [${colRange.first}-${colRange.last}], reading directly`);
                    return getCellLocator();
                }
            }
        } else if (await targetReached()) {
            // No range oracle — fall back to DOM count() check.
            if (barrier) await barrier.sync(index);
            return getCellLocator();
        }

        // Column is out of view. Scroll to bring it in.
        // In synchronized mode, the last row to arrive triggers the scroll once for all rows.
        const scrollIntoViewport = async () => {
            const colRange = viewport.getVisibleColumnRange
                ? await viewport.getVisibleColumnRange(context)
                : null;
            const colOutOfView = !colRange || index < colRange.first || index > colRange.last;

            if (colOutOfView) {
                logDebug(config, 'verbose', `_navigateToCell: col ${index} out of view, scrolling`);
                if (viewport.scrollToColumn) {
                    await viewport.scrollToColumn(context, index);
                }
            }

            // Some row locators (notably rows returned by findRow()) have a logical
            // rowIndex that is not the grid's viewport coordinate. If the target cell
            // is already mounted after any column scroll, avoid a misleading row jump.
            if (await targetReached()) {
                return;
            }

            // 2D scroll hazard guard: scrolling horizontally may have unmounted the target row.
            const rowRange = viewport.getVisibleRowRange
                ? await viewport.getVisibleRowRange(context)
                : null;
            const rowOutOfView = rowRange && (rowIndex < rowRange.first || rowIndex > rowRange.last);

            if (rowOutOfView) {
                logDebug(config, 'verbose', `_navigateToCell: row ${rowIndex} out of view after col scroll, recovering`);
                if (viewport.scrollToRow) {
                    await viewport.scrollToRow(context, rowIndex);
                }
            }
        };

        if (barrier) {
            await barrier.sync(index, scrollIntoViewport);
        } else {
            await scrollIntoViewport();
        }

        if (await targetReached()) {
            return getCellLocator();
        }

        // Cell still not accessible — fall through to navigation primitives if configured.
        if (!config.strategies.navigation) {
            const colRange = viewport.getVisibleColumnRange ? await viewport.getVisibleColumnRange(context) : null;
            const rowRange = viewport.getVisibleRowRange ? await viewport.getVisibleRowRange(context) : null;
            
            let errMsg = `SmartTable: could not reach cell for column "${column}" (colIndex ${index}) at row ${rowIndex}.\n`;
            if (colRange) {
                errMsg += `  Visible column range: [${colRange.first}–${colRange.last}]. Column is out of view and no navigation fallback is configured.\n`;
            } else {
                errMsg += `  Column is out of view and no navigation fallback is configured.\n`;
            }
            if (rowRange && rowIndex !== undefined) {
                const inView = rowIndex >= rowRange.first && rowIndex <= rowRange.last;
                errMsg += `  Visible row range: [${rowRange.first}–${rowRange.last}]. ${inView ? 'Row is in view.' : 'Row is out of view.'}\n`;
            }
            errMsg += `  → Add a \`strategies.navigation\` or \`strategies.viewport.scrollToColumn\` to handle off-screen columns.`;
            
            throw new Error(errMsg);
        }
    }

    // Use navigation primitives if available
    if (config.strategies.navigation) {
        const nav = config.strategies.navigation;

        if (typeof rowIndex !== 'number') {
            throw new Error('Row index is required for navigation');
        }

        const navigateOnce = async () => {
            // Get current position again to be sure
            let currRow = 0;
            let currCol = 0;
            if (config.strategies.getActiveCell) {
                const ac = await config.strategies.getActiveCell({ config, root: rootLocator, page, resolve });
                if (ac) {
                    currRow = ac.rowIndex;
                    currCol = ac.columnIndex;
                }
            }

            const rDiff = rowIndex - currRow;
            const cDiff = index - currCol;

            // Move one step vertically
            if (rDiff > 0 && nav.goDown) {
                logDebug(config, 'verbose', '_navigateToCell: moving down');
                await nav.goDown(context);
            } else if (rDiff < 0 && nav.goUp) {
                logDebug(config, 'verbose', '_navigateToCell: moving up');
                await nav.goUp(context);
            }

            // Move one step horizontally
            if (cDiff > 0 && nav.goRight) {
                logDebug(config, 'verbose', '_navigateToCell: moving right');
                await nav.goRight(context);
            } else if (cDiff < 0 && nav.goLeft) {
                logDebug(config, 'verbose', '_navigateToCell: moving left');
                await nav.goLeft(context);
            }
        };

        if (await targetReached()) {
            // Already there. If we have a barrier, check-in to stay in lock-step.
            if (barrier) await barrier.sync(index);
            return getCellLocator();
        }

        // If getActiveCell is present but returns null (no focus), and cell is in DOM,
        // try to focus it once before entering navigation loop.
        if (config.strategies.getActiveCell) {
            const ac = await config.strategies.getActiveCell({ config, root: rootLocator, page, resolve });
            if (!ac) {
                const cell = resolve(config.cellSelector, rowLocator).nth(index);
                if (await cell.count() > 0) {
                    logDebug(config, 'verbose', `_navigateToCell: cell "${column}" found but not focused; focusing.`);
                    await cell.focus();
                    // Re-check target
                    if (await targetReached()) {
                        if (barrier) await barrier.sync(index);
                        return cell;
                    }
                }
            }
        }

        const navigateUntilReached = async () => {
            let currRow = 0;
            let currCol = 0;
            if (config.strategies.getActiveCell) {
                const ac = await config.strategies.getActiveCell({ config, root: rootLocator, page, resolve });
                if (ac) {
                    currRow = ac.rowIndex;
                    currCol = ac.columnIndex;
                }
            }

            const rDiff = rowIndex - currRow;

            // Navigate vertically (tight loop)
            for (let i = 0; i < Math.abs(rDiff); i++) {
                if (rDiff > 0 && nav.goDown) await nav.goDown(context);
                else if (rDiff < 0 && nav.goUp) await nav.goUp(context);
            }

            if (config.strategies.getActiveCell) {
                const ac = await config.strategies.getActiveCell({ config, root: rootLocator, page, resolve });
                if (ac) {
                    currRow = ac.rowIndex;
                    currCol = ac.columnIndex;
                }
            }

            if (index === 0 && nav.snapFirstColumnIntoView) {
                logDebug(config, 'verbose', '_navigateToCell: snapFirstColumnIntoView for column index 0');
                await nav.snapFirstColumnIntoView(context);
                if (config.strategies.getActiveCell) {
                    const ac = await config.strategies.getActiveCell({ config, root: rootLocator, page, resolve });
                    if (ac) {
                        currRow = ac.rowIndex;
                        currCol = ac.columnIndex;
                    }
                }
                // Home moves a11y focus within the current row to column 0. If focus row !== target row
                // (e.g. still on previous row), Home jumps to grid origin and breaks `tr.nth(k)` reads.
                if (typeof rowIndex === 'number' && currRow === rowIndex) {
                    await rootLocator.evaluate((el) => {
                        const canvas = el.closest('canvas') || el.parentElement?.querySelector('canvas');
                        if (canvas instanceof HTMLCanvasElement) {
                            canvas.tabIndex = 0;
                            canvas.focus();
                        }
                    });
                    await page.keyboard.press('Home');
                    await page.waitForTimeout(120);
                    if (config.strategies.getActiveCell) {
                        const ac = await config.strategies.getActiveCell({ config, root: rootLocator, page, resolve });
                        if (ac) {
                            currRow = ac.rowIndex;
                            currCol = ac.columnIndex;
                        }
                    }
                }
            }

            let cDiff = index - currCol;
            if (Math.abs(cDiff) > 12 && nav.seekColumnIndex) {
                logDebug(config, 'verbose', `_navigateToCell: seekColumnIndex approx for column ${index}`);
                await nav.seekColumnIndex(context, index);
                if (config.strategies.getActiveCell) {
                    const ac = await config.strategies.getActiveCell({ config, root: rootLocator, page, resolve });
                    if (ac) {
                        currRow = ac.rowIndex;
                        currCol = ac.columnIndex;
                    }
                }
                cDiff = index - currCol;
            }
            for (let i = 0; i < Math.abs(cDiff); i++) {
                if (cDiff > 0 && nav.goRight) await nav.goRight(context);
                else if (cDiff < 0 && nav.goLeft) await nav.goLeft(context);
            }

            const horizontalSteps = Math.abs(cDiff);
            if (horizontalSteps > 0) {
                const settleMs = Math.min(2500, 60 + horizontalSteps * 12);
                await page.waitForTimeout(settleMs);
            }

            // Wait for active cell to match target: poll getActiveCell or fallback to fixed delay
            // This is the "Midas Touch" buffer needed for Glide's async accessibility updates.
            const pollIntervalMs = 10;
            const maxWaitMs = Math.min(6000, 250 + horizontalSteps * 25);
            const start = Date.now();
            while (Date.now() - start < maxWaitMs) {
                if (config.strategies.getActiveCell) {
                    const ac = await config.strategies.getActiveCell({ config, root: rootLocator, page, resolve });
                    if (ac && ac.rowIndex === rowIndex && ac.columnIndex === index) {
                        return ac.locator;
                    }
                }
                if (await targetReached()) {
                    break;
                }
                await page.waitForTimeout(pollIntervalMs);
            }
        };

        // Not there, perform (coordinated) navigation
        let navResult: Locator | null | void;
        if (barrier) {
            navResult = await barrier.sync(index, navigateUntilReached);
        } else {
            navResult = await navigateUntilReached();
        }

        if (navResult instanceof Object && (navResult as any)._isLocator) {
            const loc = navResult as unknown as Locator;
            if (await loc.count() > 0) return loc;
        }

        // Return final locator if reached
        const finalCell = getCellLocator();
        if (await finalCell.count() > 0) return finalCell;
        
        const colRange = viewport && viewport.getVisibleColumnRange ? await viewport.getVisibleColumnRange(context) : null;
        const rowRange = viewport && viewport.getVisibleRowRange ? await viewport.getVisibleRowRange(context) : null;
        
        let errMsg = `SmartTable: could not reach cell for column "${column}" (colIndex ${index}) at row ${rowIndex} after exhausting navigation strategies. Ensure navigation primitives are correctly implemented.\n`;
        if (colRange) {
            errMsg += `  Visible column range: [${colRange.first}–${colRange.last}].\n`;
        }
        if (rowRange && rowIndex !== undefined) {
            errMsg += `  Visible row range: [${rowRange.first}–${rowRange.last}].\n`;
        }
        
        throw new Error(errMsg);
    }
    
    // No horizontal strategies configured; assume table is 1D or fully rendered,
    // and let standard Playwright auto-waiting handle any lazy-loading delays.
    return getCellLocator();
};

/**
 * Factory to create a SmartRow by extending a Playwright Locator.
 * We avoid Class/Proxy to ensure full compatibility with Playwright's expect(locator) matchers.
 */
/**
 * @internal Internal factory for creating SmartRow objects.
 * Not part of the public package surface; tests and consumers should use public APIs.
 */
const createSmartRow = <T = any>(
    rowLocator: Locator,
    map: Map<string, number>,
    rowIndex: number | undefined,
    config: FinalTableConfig<T>,
    rootLocator: Locator,
    resolve: (item: any, parent: Locator | Page) => Locator,
    table: TableResult<T> | null,
    tablePageIndex?: number,
    barrier?: NavigationBarrier
): SmartRowType<T> => {
    const smart = rowLocator as unknown as SmartRowType<T> & { _barrier?: NavigationBarrier };

    // Attach State
    smart.rowIndex = rowIndex;
    smart.tablePageIndex = tablePageIndex;
    smart.table = table as any;
    smart._barrier = barrier;

    // Attach Methods
    smart.getCell = (colName: string): SmartCell => {
        const idx = map.get(colName);
        if (idx === undefined) {
            throw new Error(buildColumnNotFoundError(colName, Array.from(map.keys())));
        }

        let baseLocator: Locator;
        if (config.strategies.getCellLocator) {
            baseLocator = config.strategies.getCellLocator({
                row: rowLocator,
                root: rootLocator,
                columnName: colName,
                columnIndex: idx,
                rowIndex: rowIndex,
                page: rootLocator.page(),
                config
            });
        } else {
            baseLocator = resolve(config.cellSelector, rowLocator).nth(idx);
        }

        const smartCell = baseLocator as SmartCell;
        smartCell.bringIntoView = async () => {
            const navigatedCell = await _navigateToCell({
                config,
                rootLocator,
                page: rootLocator.page(),
                resolve,
                column: colName,
                index: idx,
                rowLocator,
                rowIndex,
                barrier: (smart as any)._barrier
            });
            if (navigatedCell && (navigatedCell as any)._locator) {
                (smartCell as any)._locator = (navigatedCell as any)._locator;
            }
        };

        return smartCell;
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
                    root: rootLocator,
                    columnName: col,
                    columnIndex: idx,
                    rowIndex: rowIndex,
                    page: page,
                    config
                })
                : resolve(config.cellSelector, rowLocator).nth(idx);

            let targetCell = cell;
            // Always call _navigateToCell to ensure Lock-Step synchronization
            // even if the cell is already present (it handles check-in inside)
            const navigatedCell = await _navigateToCell({
                config,
                rootLocator,
                page,
                resolve,
                column: col,
                index: idx,
                rowLocator,
                rowIndex,
                barrier: (smart as any)._barrier
            });

            if (navigatedCell) {
                targetCell = navigatedCell;
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
                rowIndex,
                barrier: (smart as any)._barrier
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
                let totalPages: number | undefined;
                if (primitives.getTotalPages) {
                    const tp = await primitives.getTotalPages(context);
                    if (tp !== null) totalPages = tp;
                }
                const path = planNavigationPath(getCurrent(), tablePageIndex, primitives, totalPages);
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

export default createSmartRow;

