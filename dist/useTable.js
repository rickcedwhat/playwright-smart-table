"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTable = void 0;
const useTable = (rootLocator, configOptions = {}) => {
    const config = Object.assign({ rowSelector: "tbody tr", headerSelector: "th", cellSelector: "td", pagination: undefined, maxPages: 1, columnNames: [] }, configOptions);
    const resolve = (item, parent) => {
        if (typeof item === 'string')
            return parent.locator(item);
        if (typeof item === 'function')
            return item(parent);
        throw new Error("Cannot resolve a null selector. Ensure your config defines selectors correctly.");
    };
    let _headerMap = null;
    const _getMap = () => __awaiter(void 0, void 0, void 0, function* () {
        if (_headerMap)
            return _headerMap;
        // 1. Scrape DOM (Only if headerSelector is NOT null)
        let texts = [];
        if (config.headerSelector) {
            const headerLoc = resolve(config.headerSelector, rootLocator);
            try {
                yield headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
                texts = yield headerLoc.allInnerTexts();
            }
            catch (e) { /* Ignore hydration/empty/timeout */ }
        }
        // 2. Merge Scraped Data with Config Overrides
        _headerMap = new Map();
        const overrides = config.columnNames || [];
        const colCount = Math.max(texts.length, overrides.length);
        for (let i = 0; i < colCount; i++) {
            const scrapedText = (texts[i] || "").trim() || `__col_${i}`;
            const overrideText = overrides[i];
            const finalName = (overrideText !== undefined) ? overrideText : scrapedText;
            _headerMap.set(finalName, i);
        }
        return _headerMap;
    });
    const _findRowLocator = (filters_1, ...args_1) => __awaiter(void 0, [filters_1, ...args_1], void 0, function* (filters, options = {}) {
        var _a;
        const map = yield _getMap();
        const page = rootLocator.page();
        const effectiveMaxPages = (_a = options.maxPages) !== null && _a !== void 0 ? _a : config.maxPages;
        let currentPage = 1;
        while (true) {
            if (!config.rowSelector)
                throw new Error("rowSelector cannot be null");
            let rowLocator = resolve(config.rowSelector, rootLocator);
            for (const [colName, value] of Object.entries(filters)) {
                const colIndex = map.get(colName);
                if (colIndex === undefined)
                    throw new Error(`Column '${colName}' not found. Available: ${Array.from(map.keys())}`);
                const exact = options.exact || false;
                const filterVal = typeof value === 'number' ? String(value) : value;
                // Case 1: No Cell Selector (Menu) - Filter the Row Itself
                if (!config.cellSelector) {
                    if (exact) {
                        rowLocator = rowLocator.filter({ hasText: new RegExp(`^${escapeRegExp(String(filterVal))}$`) });
                    }
                    else {
                        rowLocator = rowLocator.filter({ hasText: filterVal });
                    }
                }
                // Case 2: String Cell Selector - Standard Table Logic (Restored)
                else if (typeof config.cellSelector === 'string') {
                    // RESTORED: This logic worked for standard tables. 
                    // We resolve against the PAGE to create a generic locator template.
                    // Playwright handles the relative filtering correctly for standard tables.
                    const cellTemplate = resolve(config.cellSelector, page);
                    rowLocator = rowLocator.filter({
                        has: cellTemplate.nth(colIndex).getByText(filterVal, { exact }),
                    });
                }
                // Case 3: Function Cell Selector - Forms (Iterative Fallback)
                else {
                    const count = yield rowLocator.count();
                    let matchFound = false;
                    for (let i = 0; i < count; i++) {
                        const specificRow = rowLocator.nth(i);
                        // Resolve cell relative to this specific row
                        const specificCell = config.cellSelector(specificRow).nth(colIndex);
                        if ((yield specificCell.getByText(filterVal, { exact }).count()) > 0) {
                            if (matchFound) {
                                throw new Error(`Strict Mode Violation: Found multiple rows matching ${JSON.stringify(filters)}.`);
                            }
                            rowLocator = specificRow;
                            matchFound = true;
                            // Break inner loop to proceed to next filter or return
                            break;
                        }
                    }
                    if (!matchFound) {
                        // Return empty locator to fail gracefully
                        return resolve(config.rowSelector, rootLocator).filter({ hasText: "NON_EXISTENT_ROW_" + Date.now() });
                    }
                }
            }
            const count = yield rowLocator.count();
            if (count > 1)
                throw new Error(`Strict Mode Violation: Found ${count} rows matching ${JSON.stringify(filters)}.`);
            if (count === 1)
                return rowLocator.first();
            // --- PAGINATION ---
            if (config.pagination && currentPage < effectiveMaxPages) {
                const context = { root: rootLocator, config: config, page: page, resolve: resolve };
                if (yield config.pagination(context)) {
                    currentPage++;
                    continue;
                }
            }
            return null;
        }
    });
    return {
        getHeaders: () => __awaiter(void 0, void 0, void 0, function* () { return Array.from((yield _getMap()).keys()); }),
        getByRow: (filters_1, ...args_1) => __awaiter(void 0, [filters_1, ...args_1], void 0, function* (filters, options = {}) {
            const row = yield _findRowLocator(filters, options);
            if (!row)
                return resolve(config.rowSelector, rootLocator).filter({ hasText: "NON_EXISTENT_ROW_SENTINEL_" + Date.now() });
            return row;
        }),
        getByCell: (rowFilters, targetColumn) => __awaiter(void 0, void 0, void 0, function* () {
            const row = yield _findRowLocator(rowFilters);
            if (!row)
                throw new Error(`Row not found: ${JSON.stringify(rowFilters)}`);
            // Guard: getByCell makes no sense for Menus (no cells)
            if (!config.cellSelector) {
                throw new Error("getByCell is not supported when 'cellSelector' is null (e.g. Menus). Use getByRow instead.");
            }
            const map = yield _getMap();
            const colIndex = map.get(targetColumn);
            if (colIndex === undefined)
                throw new Error(`Column '${targetColumn}' not found.`);
            if (typeof config.cellSelector === 'string') {
                return row.locator(config.cellSelector).nth(colIndex);
            }
            else {
                return resolve(config.cellSelector, row).nth(colIndex);
            }
        }),
        getRows: () => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield _getMap();
            const rowLocator = resolve(config.rowSelector, rootLocator);
            const rowCount = yield rowLocator.count();
            const results = [];
            for (let i = 0; i < rowCount; i++) {
                const row = rowLocator.nth(i);
                let cellTexts = [];
                if (!config.cellSelector) {
                    cellTexts = [yield row.innerText()];
                }
                else if (typeof config.cellSelector === 'string') {
                    // For string selectors, we query all matching cells in the row
                    cellTexts = yield row.locator(config.cellSelector).allInnerTexts();
                }
                else {
                    // For function selectors, we resolve against the row
                    cellTexts = yield resolve(config.cellSelector, row).allInnerTexts();
                }
                const rowData = {};
                for (const [colName, colIdx] of map.entries()) {
                    rowData[colName] = (cellTexts[colIdx] || "").trim();
                }
                results.push(rowData);
            }
            return results;
        }),
        getRowAsJSON: (filters) => __awaiter(void 0, void 0, void 0, function* () {
            const row = yield _findRowLocator(filters);
            if (!row)
                throw new Error(`Row not found: ${JSON.stringify(filters)}`);
            let cellTexts = [];
            if (!config.cellSelector) {
                cellTexts = [yield row.innerText()];
            }
            else if (typeof config.cellSelector === 'string') {
                cellTexts = yield row.locator(config.cellSelector).allInnerTexts();
            }
            else {
                cellTexts = yield resolve(config.cellSelector, row).allInnerTexts();
            }
            const map = yield _getMap();
            const result = {};
            for (const [colName, colIndex] of map.entries()) {
                result[colName] = (cellTexts[colIndex] || "").trim();
            }
            return result;
        }),
        setColumnName: (colIndex, newNameOrFn) => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield _getMap();
            let oldName = "";
            for (const [name, idx] of map.entries()) {
                if (idx === colIndex) {
                    oldName = name;
                    break;
                }
            }
            if (!oldName)
                oldName = `__col_${colIndex}`;
            const newName = typeof newNameOrFn === 'function' ? newNameOrFn(oldName) : newNameOrFn;
            if (map.has(oldName))
                map.delete(oldName);
            map.set(newName, colIndex);
        }),
        generateConfigPrompt: () => __awaiter(void 0, void 0, void 0, function* () {
            const html = yield rootLocator.evaluate((el) => el.outerHTML);
            console.log(`\n=== CONFIG PROMPT ===\nI have this HTML:\n\`\`\`html\n${html}\n\`\`\`\nGenerate a 'useTable' config for it.`);
        }),
        generateStrategyPrompt: () => __awaiter(void 0, void 0, void 0, function* () {
            const container = rootLocator.locator('xpath=..');
            const html = yield container.evaluate((el) => el.outerHTML);
            console.log(`\n=== STRATEGY PROMPT ===\nI have this Container HTML:\n\`\`\`html\n${html.substring(0, 2000)}\n\`\`\`\nWrite a pagination strategy.`);
        })
    };
};
exports.useTable = useTable;
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
