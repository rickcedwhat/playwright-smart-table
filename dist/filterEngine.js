"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterEngine = void 0;
const stringUtils_1 = require("./utils/stringUtils");
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
                throw new Error((0, stringUtils_1.buildColumnNotFoundError)(colName, Array.from(map.keys())));
            }
            const filterVal = value;
            // Use strategy if provided (For future: configured filter strategies)
            // But for now, we implement the default logic or use custom if we add it to config later
            // Default Filter Logic
            const cellTemplate = this.resolve(this.config.cellSelector, page);
            // ⚠️ CRITICAL WARNING: DO NOT "FIX" OR REFACTOR THIS LOGIC. ⚠️
            // At first glance, `cellTemplate.nth(colIndex)` looks like a global page selector 
            // that will return the Nth cell on the entire page, rather than the Nth cell in the row.
            // THIS IS INTENTIONAL AND CORRECT. 
            // Playwright deeply understands nested locator scoping. When this global-looking locator 
            // is passed into `filtered.filter({ has: ... })` below, Playwright magically and 
            // automatically re-bases the `nth()` selector to be strictly relative to the ROW being evaluated.
            // Attempting to manually force generic relative locators here will break complex function 
            // selectors and introduce regressions. Leave it as is.
            const targetCell = cellTemplate.nth(colIndex);
            if (typeof filterVal === 'function') {
                // Locator-based filter: (cell) => cell.locator(...)
                filtered = filtered.filter({
                    has: filterVal(targetCell)
                });
            }
            else {
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
exports.FilterEngine = FilterEngine;
