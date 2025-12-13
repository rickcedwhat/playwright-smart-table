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
const test_1 = require("@playwright/test");
const typeContext_1 = require("./typeContext");
const useTable = (rootLocator, configOptions = {}) => {
    const config = Object.assign({ rowSelector: "tbody tr", headerSelector: "th", cellSelector: "td", pagination: undefined, maxPages: 1, headerTransformer: undefined, autoScroll: true }, configOptions);
    const resolve = (item, parent) => {
        if (typeof item === 'string')
            return parent.locator(item);
        if (typeof item === 'function')
            return item(parent);
        return item;
    };
    let _headerMap = null;
    const _getMap = () => __awaiter(void 0, void 0, void 0, function* () {
        if (_headerMap)
            return _headerMap;
        // ✅ New Feature: Auto-Scroll on first interaction
        if (config.autoScroll) {
            yield rootLocator.scrollIntoViewIfNeeded();
        }
        const headerLoc = resolve(config.headerSelector, rootLocator);
        try {
            yield headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
        }
        catch (e) { /* Ignore hydration */ }
        const texts = yield headerLoc.allInnerTexts();
        _headerMap = new Map(texts.map((t, i) => {
            let text = t.trim() || `__col_${i}`;
            if (config.headerTransformer)
                text = config.headerTransformer(text, i);
            return [text, i];
        }));
        return _headerMap;
    });
    const _makeSmart = (rowLocator, map) => {
        const smart = rowLocator;
        smart.getCell = (colName) => {
            const idx = map.get(colName);
            if (idx === undefined)
                throw new Error(`Column '${colName}' not found.`);
            if (typeof config.cellSelector === 'string') {
                return rowLocator.locator(config.cellSelector).nth(idx);
            }
            else {
                return resolve(config.cellSelector, rowLocator).nth(idx);
            }
        };
        smart.toJSON = () => __awaiter(void 0, void 0, void 0, function* () {
            const result = {};
            const cells = typeof config.cellSelector === 'string'
                ? rowLocator.locator(config.cellSelector)
                : resolve(config.cellSelector, rowLocator);
            const texts = yield cells.allInnerTexts();
            for (const [col, idx] of map.entries()) {
                result[col] = (texts[idx] || '').trim();
            }
            return result;
        });
        return smart;
    };
    // ♻️ HELPER: Centralized logic to filter a row locator
    const _applyFilters = (baseRows, filters, map, exact) => {
        let filtered = baseRows;
        const page = rootLocator.page();
        for (const [colName, value] of Object.entries(filters)) {
            const colIndex = map.get(colName);
            if (colIndex === undefined)
                throw new Error(`Column '${colName}' not found.`);
            const filterVal = typeof value === 'number' ? String(value) : value;
            const cellTemplate = resolve(config.cellSelector, page);
            // Filter the TRs that contain the matching cell at the specific index
            filtered = filtered.filter({
                has: cellTemplate.nth(colIndex).getByText(filterVal, { exact }),
            });
        }
        return filtered;
    };
    const _handlePrompt = (promptName_1, content_1, ...args_1) => __awaiter(void 0, [promptName_1, content_1, ...args_1], void 0, function* (promptName, content, options = {}) {
        const { output = 'console', includeTypes = true } = options; // Default includeTypes to true
        let finalPrompt = content;
        if (includeTypes) {
            // ✅ Inject the dynamic TYPE_CONTEXT
            finalPrompt += `\n\n👇 Useful TypeScript Definitions 👇\n\`\`\`typescript\n${typeContext_1.TYPE_CONTEXT}\n\`\`\`\n`;
        }
        if (output === 'console') {
            console.log(finalPrompt);
        }
        else if (output === 'report') {
            if (test_1.test.info()) {
                yield test_1.test.info().attach(promptName, {
                    body: finalPrompt,
                    contentType: 'text/markdown'
                });
                console.log(`✅ Attached '${promptName}' to Playwright Report.`);
            }
            else {
                console.warn('⚠️ Cannot attach to report: No active test info found.');
                console.log(finalPrompt);
            }
        }
        // ... (file output logic) ...
    });
    const _findRowLocator = (filters_1, ...args_1) => __awaiter(void 0, [filters_1, ...args_1], void 0, function* (filters, options = {}) {
        var _a;
        const map = yield _getMap();
        const effectiveMaxPages = (_a = options.maxPages) !== null && _a !== void 0 ? _a : config.maxPages;
        let currentPage = 1;
        while (true) {
            // 1. Get all rows
            const allRows = resolve(config.rowSelector, rootLocator);
            // 2. Apply filters using helper
            const matchedRows = _applyFilters(allRows, filters, map, options.exact || false);
            // 3. Check Count
            const count = yield matchedRows.count();
            if (count > 1)
                throw new Error(`Strict Mode Violation: Found ${count} rows matching ${JSON.stringify(filters)}.`);
            if (count === 1)
                return matchedRows.first();
            // 4. Pagination Logic (unchanged)
            if (config.pagination && currentPage < effectiveMaxPages) {
                // ... (pagination code same as before)
                const context = { root: rootLocator, config, page: rootLocator.page(), resolve };
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
        getHeaderCell: (columnName) => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield _getMap();
            const idx = map.get(columnName);
            if (idx === undefined)
                throw new Error(`Column '${columnName}' not found.`);
            return resolve(config.headerSelector, rootLocator).nth(idx);
        }),
        getByRow: (filters, options) => __awaiter(void 0, void 0, void 0, function* () {
            let row = yield _findRowLocator(filters, options);
            // ✅ FIX: Sentinel Logic for negative assertions (expect(row).not.toBeVisible())
            if (!row) {
                row = resolve(config.rowSelector, rootLocator).filter({ hasText: "___SENTINEL_ROW_NOT_FOUND___" + Date.now() });
            }
            const smartRow = _makeSmart(row, yield _getMap());
            if (options === null || options === void 0 ? void 0 : options.asJSON) {
                // If row doesn't exist, toJSON() returns empty object or throws? 
                // For safety, let's let it run naturally (it will likely return empty strings)
                return smartRow.toJSON();
            }
            return smartRow;
        }),
        getAllRows: (options) => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield _getMap();
            let rowLocators = resolve(config.rowSelector, rootLocator);
            // ✅ NEW: Apply filters if they exist
            if (options === null || options === void 0 ? void 0 : options.filter) {
                rowLocators = _applyFilters(rowLocators, options.filter, map, options.exact || false);
            }
            // Convert Locator to array of Locators
            const rows = yield rowLocators.all();
            const smartRows = rows.map(loc => _makeSmart(loc, map));
            if (options === null || options === void 0 ? void 0 : options.asJSON) {
                return Promise.all(smartRows.map(r => r.toJSON()));
            }
            return smartRows;
        }),
        generateConfigPrompt: (options) => __awaiter(void 0, void 0, void 0, function* () {
            const html = yield rootLocator.evaluate((el) => el.outerHTML);
            const separator = "=".repeat(50);
            const content = `\n${separator}\n🤖 COPY INTO GEMINI/ChatGPT 🤖\n${separator}\nI am using 'playwright-smart-table'. Generate config for:\n\`\`\`html\n${html.substring(0, 5000)} ...\n\`\`\`\n${separator}\n`;
            yield _handlePrompt('Smart Table Config', content, options);
        }),
        generateStrategyPrompt: (options) => __awaiter(void 0, void 0, void 0, function* () {
            const container = rootLocator.locator('xpath=..');
            const html = yield container.evaluate((el) => el.outerHTML);
            const content = `\n==================================================\n🤖 COPY INTO GEMINI/ChatGPT TO WRITE A STRATEGY 🤖\n==================================================\nI need a custom Pagination Strategy for 'playwright-smart-table'.\nContainer HTML:\n\`\`\`html\n${html.substring(0, 5000)} ...\n\`\`\`\n`;
            yield _handlePrompt('Smart Table Strategy', content, options);
        })
    };
};
exports.useTable = useTable;
