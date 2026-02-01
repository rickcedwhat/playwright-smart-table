import { Locator, Page } from "@playwright/test";
import { FinalTableConfig, TableContext, FilterStrategy } from "./types";
import { buildColumnNotFoundError } from "./utils/stringUtils";

export class FilterEngine {
    constructor(
        private config: FinalTableConfig,
        private resolve: (selector: any, parent: Locator | Page) => Locator
    ) { }

    /**
     * Applies filters to a set of rows.
     */
    applyFilters(
        baseRows: Locator,
        filters: Record<string, string | RegExp | number>,
        map: Map<string, number>,
        exact: boolean,
        page: Page
    ): Locator {
        let filtered = baseRows;

        // Iterate through each filter criteria
        for (const [colName, value] of Object.entries(filters)) {
            // Find column index
            const colIndex = map.get(colName);

            // TODO: Use ColumnStrategy for better resolution error handling
            if (colIndex === undefined) {
                throw new Error(buildColumnNotFoundError(colName, Array.from(map.keys())));
            }

            const filterVal = typeof value === 'number' ? String(value) : value;

            // Use strategy if provided (For future: configured filter strategies)
            // But for now, we implement the default logic or use custom if we add it to config later

            // Default Filter Logic
            const cellTemplate = this.resolve(this.config.cellSelector, page);

            // This logic assumes 1:1 row-to-cell mapping based on index.
            // filter({ has: ... }) checks if the row *contains* the matching cell.
            // But we need to be specific about WHICH cell.
            // Locator filtering by `has: locator.nth(index)` works if `locator` search is relative to the row.

            filtered = filtered.filter({
                has: cellTemplate.nth(colIndex).getByText(filterVal, { exact }),
            });
        }
        return filtered;
    }
}
