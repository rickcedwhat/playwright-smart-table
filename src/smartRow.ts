import type { Locator, Page } from '@playwright/test';
import { SmartRow as SmartRowType, FillOptions, FinalTableConfig, TableResult, SmartCell } from './types';
import { resolveLogicalRowIndex } from './engine/rowResolution';
import { navigateToCell } from './engine/cellNavigation';
import { headerCellGetter, readRowAtomic, readRowLive, RowSnapshotEnv } from './engine/rowSnapshot';
import { FillStrategies } from './strategies/fill';
import { buildColumnNotFoundError } from './utils/stringUtils';
import { debugDelay, logDebug } from './utils/debugUtils';
import { planNavigationPath, executeNavigationPath, executeNavigationWithGoToPageRetry } from './utils/paginationPath';
import { SENTINEL_ROW } from './utils/sentinel';
import { NavigationBarrier } from './utils/navigationBarrier';
import { setCurrentPageIndex } from './utils/pageIndex';
import type { SmartRowInternals } from './utils/smartRowInternals';
import { describeLocator, getLocatorDescription } from './utils/locatorDescription';

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
    barrier?: NavigationBarrier,
    renderWindowPosition = false,
): SmartRowType<T> => {
    const smart = rowLocator as unknown as SmartRowType<T> & SmartRowInternals;

    // Attach State
    smart.rowIndex = rowIndex;
    smart.tablePageIndex = tablePageIndex;
    smart.table = table as any;
    smart._barrier = barrier;

    // Attach Methods
    smart.getCell = (colName: string): SmartCell => {
        if (config.syntheticColumns?.[colName]) {
            throw new Error(`Column "${colName}" is synthetic (no DOM cell) — use getValue("${colName}") or toJSON() instead`);
        }
        const idx = map.get(colName);
        if (idx === undefined) {
            throw new Error(buildColumnNotFoundError(colName, [...map.keys(), ...Object.keys(config.syntheticColumns ?? {})]));
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

        const cellDescription = `${getLocatorDescription(rowLocator) ?? 'SmartRow'} › "${colName}" cell`;
        const smartCell = describeLocator(baseLocator, cellDescription, config) as SmartCell;
        smartCell.bringIntoView = async () => {
            const page = rootLocator.page();
            const navigatedCell = await navigateToCell({
                config,
                rootLocator,
                page,
                resolve,
                getHeaders: table?.getHeaders,
                column: colName,
                index: idx,
                rowLocator,
                rowIndex,
                renderWindowPosition,
                barrier: smart._barrier
            });
            // Run beforeCellRead hook (same as toJSON does after navigation).
            if (config.strategies.beforeCellRead) {
                const getHeaderCell = headerCellGetter({ config, rootLocator, resolve, map, table });
                await config.strategies.beforeCellRead({
                    cell: navigatedCell ?? baseLocator,
                    columnName: colName,
                    columnIndex: idx,
                    row: rowLocator,
                    page,
                    root: rootLocator,
                    getHeaderCell,
                });
            }
        };

        return smartCell;
    };

    smart.wasFound = (): boolean => {
        return !(smart as any)[SENTINEL_ROW];
    };

    smart.getValue = async (colName: string): Promise<string> => {
        const syntheticDef = config.syntheticColumns?.[colName];
        if (syntheticDef) {
            const guardedRow = Object.create(smart) as typeof smart;
            guardedRow.getValue = async (innerCol: string): Promise<string> => {
                if (config.syntheticColumns?.[innerCol]) {
                    throw new Error(
                        `[SmartTable] Synthetic column "${innerCol}" cannot be read from inside another synthetic column's compute(). ` +
                        `Synthetic columns may only reference real or override columns.`
                    );
                }
                return smart.getValue(innerCol);
            };
            return String(await syntheticDef.compute(guardedRow));
        }

        const idx = map.get(colName);
        if (idx === undefined) {
            throw new Error(buildColumnNotFoundError(colName, [...map.keys(), ...Object.keys(config.syntheticColumns ?? {})]));
        }

        const columnOverride = config.columnOverrides?.[colName as keyof T];
        const page = rootLocator.page();
        // Same nav pipeline as toJSON / getCell().bringIntoView() (#430) so virtualized
        // off-screen columns don't return empty/stale text.
        const cell = await navigateToCell({
            config,
            rootLocator,
            page,
            resolve,
            getHeaders: table?.getHeaders,
            column: colName,
            index: idx,
            rowLocator,
            rowIndex,
            renderWindowPosition,
            barrier: smart._barrier,
            allowMissingCell: !!columnOverride?.read,
        });

        if (columnOverride?.read) {
            const getCell = (name: string): Locator => {
                const ci = map.get(name);
                if (ci === undefined) throw new Error(`Column "${name}" not found`);
                return resolve(config.cellSelector, rowLocator).nth(ci);
            };
            return String(await columnOverride.read(cell, { row: smart, columnName: colName, columnIndex: idx, getCell }));
        }

        return (await cell.innerText()).trim();
    };

    const snapshotEnv: RowSnapshotEnv<T> = {
        config, rootLocator, resolve, map, row: smart, rowLocator, rowIndex, table, renderWindowPosition,
    };

    smart.toJSON = async (options?: { columns?: string[]; atomic?: boolean }): Promise<T> => {
        return options?.atomic
            ? readRowAtomic(snapshotEnv, options.columns)
            : readRowLive(snapshotEnv, options?.columns);
    };

    smart.smartFill = async (data: Partial<T> | Record<string, any>, fillOptions?: FillOptions): Promise<void> => {
        logDebug(config, 'info', 'Filling row', data);

        for (const [colName, value] of Object.entries(data)) {
            if (value === undefined) continue;

            if (config.syntheticColumns?.[colName]) {
                throw new Error(`Cannot fill synthetic column "${colName}" — it has no DOM cell`);
            }

            const colIdx = map.get(colName);
            if (colIdx === undefined) {
                throw new Error(buildColumnNotFoundError(colName, [...map.keys(), ...Object.keys(config.syntheticColumns ?? {})]));
            }

            await navigateToCell({
                config,
                rootLocator,
                page: rootLocator.page(),
                resolve,
                getHeaders: table?.getHeaders,
                column: colName,
                index: colIdx,
                rowLocator,
                rowIndex,
                renderWindowPosition,
                barrier: smart._barrier
            });

            const columnOverride = config.columnOverrides?.[colName as keyof T];
            try {
                if (columnOverride?.write) {
                    const cellLocator = smart.getCell(colName);

                    let currentValue;
                    if (columnOverride.read) {
                        currentValue = await columnOverride.read(cellLocator, {
                            row: smart, columnName: colName, columnIndex: colIdx,
                            getCell: (name: string) => smart.getCell(name),
                        });
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
            } catch (err) {
                const source = columnOverride?.write ? 'columnOverrides.write' : 'fill strategy';
                const wrapped = new Error(
                    `[SmartTable] smartFill: ${source} for "${colName}" failed — ${err instanceof Error ? err.message : String(err)}`,
                );
                (wrapped as any).cause = err;
                throw wrapped;
            }

            // Delay after filling
            await debugDelay(config, 'getCell');
        }

        logDebug(config, 'info', 'Row fill complete');
    };

    smart.bringIntoView = async (): Promise<void> => {
        if (rowIndex === undefined) {
            logDebug(config, 'info', 'bringIntoView called on a row with unknown rowIndex (e.g. from getRow()). ' +
                'Page navigation and scrolling will proceed, but virtual-scroll keyboard navigation will be skipped. ' +
                'Use findRow() if you need accurate rowIndex.');
        }

        const parentTable = smart.table as TableResult<T>;

        // Cross-page Navigation: when goToPage exists use retry loop (supports windowed UIs); otherwise use path planner or goToFirst+goNext
        if (tablePageIndex !== undefined && config.strategies.pagination) {
            const primitives = config.strategies.pagination as import('./types').PaginationPrimitives;
            const context = { root: rootLocator, config, page: rootLocator.page(), resolve };
            const getCurrent = () => parentTable.currentPageIndex;
            const setCurrent = (n: number) => { setCurrentPageIndex(parentTable, n); };

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
                    setCurrentPageIndex(parentTable, tablePageIndex);
                } else {
                    logDebug(config, 'error', `Cannot bring row on page ${tablePageIndex} into view. No backwards pagination strategies (goToPage, goPrevious, goPreviousBulk, or goToFirst+goNext) provided.`);
                    throw new Error(`Cannot bring row on page ${tablePageIndex} into view: Row is on a different page and no backward pagination primitive found.`);
                }
            }
        }

        // Delay after pagination/finding before scrolling
        await debugDelay(config, 'findRow');

        // Prefer viewport.scrollToRow when configured (#430). scrollIntoViewIfNeeded adjusts
        // both axes and can evict sibling rows on recycling virtualizers.
        const viewport = config.strategies.viewport;
        const logicalRowIndex = viewport?.scrollToRow && renderWindowPosition
            ? (await resolveLogicalRowIndex(rowLocator, config, () => undefined))?.index
            : rowIndex;
        if (viewport?.scrollToRow && typeof logicalRowIndex === 'number') {
            const page = rootLocator.page();
            logDebug(config, 'verbose', `bringIntoView: viewport.scrollToRow(${logicalRowIndex})`);
            await viewport.scrollToRow(
                { root: rootLocator, config, page, resolve, getHeaders: parentTable?.getHeaders },
                logicalRowIndex,
            );
        } else {
            await rowLocator.scrollIntoViewIfNeeded();
        }
    };

    return smart;
};

export default createSmartRow;
