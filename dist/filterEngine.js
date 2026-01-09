"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterEngine = void 0;
class FilterEngine {
    constructor(config, resolve) {
        this.config = config;
        this.resolve = resolve;
    }
    /**
     * Applies filters to a set of rows.
     */
    applyFilters(baseRows, filters, map, exact, page) {
        let filtered = baseRows;
        // Iterate through each filter criteria
        for (const [colName, value] of Object.entries(filters)) {
            // Find column index
            const colIndex = map.get(colName);
            // TODO: Use ColumnStrategy for better resolution error handling
            if (colIndex === undefined) {
                throw new Error(`Filter Error: Column "${colName}" not found.`);
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
exports.FilterEngine = FilterEngine;
