import { Locator, Page } from "@playwright/test";
import { FinalTableConfig, TableContext, FilterValue } from "./types";
import { buildColumnNotFoundError } from "./utils/stringUtils";
import { resolveCellLocatorForFilter } from "./utils/resolveCellLocator";

export class FilterEngine {
    constructor(
        private config: FinalTableConfig,
        private resolve: (selector: any, parent: Locator | Page) => Locator
    ) { }

    /**
     * Applies filters to a set of rows.
     *
     * Note: `rootLocator` is optional for backward compatibility in call sites that already
     * pass only the page. When strategies.filter is present we construct a TableContext
     * using the provided `rootLocator`.
     *
     * When `strategies.getCellLocator` is set, cells are resolved through that strategy
     * (via a `:scope` row stub) so column-virtualized grids that use `aria-colindex` / etc.
     * are not filtered with fragile `.nth(colIndex)` DOM order.
     */
    applyFilters(
        baseRows: Locator,
        filters: Record<string, FilterValue>,
        map: Map<string, number>,
        exact: boolean,
        page: Page,
        rootLocator?: Locator
    ): Locator {
        let filtered = baseRows;

        // Iterate through each filter criteria
        for (const [colName, value] of Object.entries(filters)) {
            // Find column index
            const colIndex = map.get(colName);

            if (colIndex === undefined) {
                throw new Error(buildColumnNotFoundError(colName, Array.from(map.keys())));
            }

            const filterVal = value;

            // If a pluggable FilterStrategy is provided, prefer it.
            if (this.config.strategies?.filter && typeof this.config.strategies.filter.apply === 'function') {
                const tableContext: TableContext = {
                    root: rootLocator as any,
                    config: this.config,
                    page,
                    resolve: this.resolve
                };
                filtered = this.config.strategies.filter.apply({
                    rows: filtered,
                    filter: { column: colName, value: filterVal },
                    colIndex,
                    tableContext
                });
                continue;
            }

            // Prefer getCellLocator (column-virtualized presets); else cellSelector.nth.
            // Playwright re-bases the `has` locator into each candidate row.
            const targetCell = resolveCellLocatorForFilter({
                config: this.config,
                resolve: this.resolve,
                page,
                root: rootLocator,
                columnName: colName,
                columnIndex: colIndex,
            });

            if (typeof filterVal === 'function') {
                // Locator-based filter: (cell) => cell.locator(...)
                filtered = filtered.filter({
                    has: filterVal(targetCell)
                });
            } else {
                // Text-based filter
                const textVal = typeof filterVal === 'number' ? String(filterVal) : filterVal;
                filtered = filtered.filter({
                    has: targetCell.getByText(textVal, { exact }),
                });
            }
        }
        return filtered;
    }
}
