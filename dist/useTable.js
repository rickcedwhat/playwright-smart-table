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
const typeContext_1 = require("./typeContext");
const useTable = (rootLocator, configOptions = {}) => {
    const config = Object.assign({ rowSelector: "tbody tr", headerSelector: "th", cellSelector: "td", pagination: () => __awaiter(void 0, void 0, void 0, function* () { return false; }), maxPages: 1, headerTransformer: ({ text, index, locator }) => text, autoScroll: true, debug: false, onReset: () => __awaiter(void 0, void 0, void 0, function* () { console.warn("⚠️ .reset() called but no 'onReset' strategy defined in config."); }) }, configOptions);
    const resolve = (item, parent) => {
        if (typeof item === 'string')
            return parent.locator(item);
        if (typeof item === 'function')
            return item(parent);
        return item;
    };
    // Internal State
    let _headerMap = null;
    let _hasPaginated = false;
    const logDebug = (msg) => {
        if (config.debug)
            console.log(`🔎 [SmartTable Debug] ${msg}`);
    };
    const _suggestColumnName = (colName, availableColumns) => {
        // Simple fuzzy matching - find columns with similar names
        const lowerCol = colName.toLowerCase();
        const suggestions = availableColumns.filter(col => col.toLowerCase().includes(lowerCol) ||
            lowerCol.includes(col.toLowerCase()) ||
            col.toLowerCase().replace(/\s+/g, '') === lowerCol.replace(/\s+/g, ''));
        if (suggestions.length > 0 && suggestions[0] !== colName) {
            return `. Did you mean "${suggestions[0]}"?`;
        }
        // Show similar column names (first 3)
        if (availableColumns.length > 0 && availableColumns.length <= 10) {
            return `. Available columns: ${availableColumns.map(c => `"${c}"`).join(', ')}`;
        }
        else if (availableColumns.length > 0) {
            return `. Available columns (first 5): ${availableColumns.slice(0, 5).map(c => `"${c}"`).join(', ')}, ...`;
        }
        return '.';
    };
    const _createColumnError = (colName, map, context) => {
        const availableColumns = Array.from(map.keys());
        const suggestion = _suggestColumnName(colName, availableColumns);
        const contextMsg = context ? ` (${context})` : '';
        return new Error(`Column "${colName}" not found${contextMsg}${suggestion}`);
    };
    const _getMap = () => __awaiter(void 0, void 0, void 0, function* () {
        if (_headerMap)
            return _headerMap;
        logDebug('Mapping headers...');
        if (config.autoScroll) {
            try {
                yield rootLocator.scrollIntoViewIfNeeded({ timeout: 1000 });
            }
            catch (e) { }
        }
        const headerLoc = resolve(config.headerSelector, rootLocator);
        try {
            yield headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
        }
        catch (e) { /* Ignore hydration */ }
        // 1. Fetch data efficiently
        const texts = yield headerLoc.allInnerTexts();
        const locators = yield headerLoc.all();
        // 2. Map Headers (Async)
        const entries = yield Promise.all(texts.map((t, i) => __awaiter(void 0, void 0, void 0, function* () {
            let text = t.trim() || `__col_${i}`;
            if (config.headerTransformer) {
                text = yield config.headerTransformer({
                    text,
                    index: i,
                    locator: locators[i]
                });
            }
            return [text, i];
        })));
        _headerMap = new Map(entries);
        logDebug(`Mapped ${entries.length} columns: ${JSON.stringify(entries.map(e => e[0]))}`);
        return _headerMap;
    });
    const _makeSmart = (rowLocator, map) => {
        const smart = rowLocator;
        smart.getCell = (colName) => {
            const idx = map.get(colName);
            if (idx === undefined) {
                const availableColumns = Array.from(map.keys());
                const suggestion = _suggestColumnName(colName, availableColumns);
                throw new Error(`Column "${colName}" not found${suggestion}`);
            }
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
        smart.fill = (data, fillOptions) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            logDebug(`Filling row with data: ${JSON.stringify(data)}`);
            // Fill each column
            for (const [colName, value] of Object.entries(data)) {
                const colIdx = map.get(colName);
                if (colIdx === undefined) {
                    throw _createColumnError(colName, map, 'in fill data');
                }
                const cell = smart.getCell(colName);
                // Use custom input mapper for this column if provided, otherwise auto-detect
                let inputLocator;
                if ((_a = fillOptions === null || fillOptions === void 0 ? void 0 : fillOptions.inputMappers) === null || _a === void 0 ? void 0 : _a[colName]) {
                    inputLocator = fillOptions.inputMappers[colName](cell);
                }
                else {
                    // Auto-detect input type
                    // Try different input types in order of commonality
                    // Check for text input
                    const textInput = cell.locator('input[type="text"], input:not([type]), textarea').first();
                    const textInputCount = yield textInput.count().catch(() => 0);
                    // Check for select
                    const select = cell.locator('select').first();
                    const selectCount = yield select.count().catch(() => 0);
                    // Check for checkbox/radio
                    const checkbox = cell.locator('input[type="checkbox"], input[type="radio"], [role="checkbox"]').first();
                    const checkboxCount = yield checkbox.count().catch(() => 0);
                    // Check for contenteditable or div-based inputs
                    const contentEditable = cell.locator('[contenteditable="true"]').first();
                    const contentEditableCount = yield contentEditable.count().catch(() => 0);
                    // Determine which input to use (prioritize by commonality)
                    if (textInputCount > 0 && selectCount === 0 && checkboxCount === 0) {
                        inputLocator = textInput;
                    }
                    else if (selectCount > 0) {
                        inputLocator = select;
                    }
                    else if (checkboxCount > 0) {
                        inputLocator = checkbox;
                    }
                    else if (contentEditableCount > 0) {
                        inputLocator = contentEditable;
                    }
                    else if (textInputCount > 0) {
                        // Fallback to text input even if others exist
                        inputLocator = textInput;
                    }
                    else {
                        // No input found - try to click the cell itself (might trigger an editor)
                        inputLocator = cell;
                    }
                    // Warn if multiple inputs found (ambiguous)
                    const totalInputs = textInputCount + selectCount + checkboxCount + contentEditableCount;
                    if (totalInputs > 1 && config.debug) {
                        logDebug(`⚠️ Multiple inputs found in cell "${colName}" (${totalInputs} total). Using first match. Consider using inputMapper option for explicit control.`);
                    }
                }
                // Fill based on value type and input type
                const inputTag = yield inputLocator.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'unknown');
                const inputType = yield inputLocator.getAttribute('type').catch(() => null);
                const isContentEditable = yield inputLocator.getAttribute('contenteditable').catch(() => null);
                logDebug(`Filling "${colName}" with value "${value}" (input: ${inputTag}, type: ${inputType})`);
                if (inputType === 'checkbox' || inputType === 'radio') {
                    // Boolean value for checkbox/radio
                    const shouldBeChecked = Boolean(value);
                    const isChecked = yield inputLocator.isChecked().catch(() => false);
                    if (isChecked !== shouldBeChecked) {
                        yield inputLocator.click();
                    }
                }
                else if (inputTag === 'select') {
                    // Select dropdown
                    yield inputLocator.selectOption(String(value));
                }
                else if (isContentEditable === 'true') {
                    // Contenteditable div
                    yield inputLocator.click();
                    yield inputLocator.fill(String(value));
                }
                else {
                    // Text input, textarea, or generic
                    yield inputLocator.fill(String(value));
                }
            }
            logDebug('Fill operation completed');
        });
        return smart;
    };
    const _applyFilters = (baseRows, filters, map, exact) => {
        let filtered = baseRows;
        const page = rootLocator.page();
        for (const [colName, value] of Object.entries(filters)) {
            const colIndex = map.get(colName);
            if (colIndex === undefined) {
                throw _createColumnError(colName, map, 'in filter');
            }
            const filterVal = typeof value === 'number' ? String(value) : value;
            const cellTemplate = resolve(config.cellSelector, page);
            filtered = filtered.filter({
                has: cellTemplate.nth(colIndex).getByText(filterVal, { exact }),
            });
        }
        return filtered;
    };
    const _findRowLocator = (filters_1, ...args_1) => __awaiter(void 0, [filters_1, ...args_1], void 0, function* (filters, options = {}) {
        var _a;
        const map = yield _getMap();
        const effectiveMaxPages = (_a = options.maxPages) !== null && _a !== void 0 ? _a : config.maxPages;
        let currentPage = 1;
        logDebug(`Looking for row: ${JSON.stringify(filters)} (MaxPages: ${effectiveMaxPages})`);
        while (true) {
            const allRows = resolve(config.rowSelector, rootLocator);
            const matchedRows = _applyFilters(allRows, filters, map, options.exact || false);
            const count = yield matchedRows.count();
            logDebug(`Page ${currentPage}: Found ${count} matches.`);
            if (count > 1) {
                // Try to get sample row data to help user identify the issue
                const sampleData = [];
                try {
                    const firstFewRows = yield matchedRows.all();
                    const sampleCount = Math.min(firstFewRows.length, 3);
                    for (let i = 0; i < sampleCount; i++) {
                        const rowData = yield _makeSmart(firstFewRows[i], map).toJSON();
                        sampleData.push(JSON.stringify(rowData));
                    }
                }
                catch (e) {
                    // If we can't extract sample data, that's okay - continue without it
                }
                const sampleMsg = sampleData.length > 0
                    ? `\nSample matching rows:\n${sampleData.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}`
                    : '';
                throw new Error(`Strict Mode Violation: Found ${count} rows matching ${JSON.stringify(filters)} on page ${currentPage}. ` +
                    `Expected exactly one match. Try adding more filters to make your query unique.${sampleMsg}`);
            }
            if (count === 1)
                return matchedRows.first();
            if (currentPage < effectiveMaxPages) {
                logDebug(`Page ${currentPage}: Not found. Attempting pagination...`);
                const context = {
                    root: rootLocator,
                    config: config,
                    page: rootLocator.page(),
                    resolve: resolve
                };
                const didLoadMore = yield config.pagination(context);
                if (didLoadMore) {
                    _hasPaginated = true;
                    currentPage++;
                    continue;
                }
                else {
                    logDebug(`Page ${currentPage}: Pagination failed (end of data).`);
                }
            }
            if (_hasPaginated) {
                console.warn(`⚠️ [SmartTable] Row not found. The table has been paginated (Current Page: ${currentPage}). You may need to call 'await table.reset()' if the target row is on a previous page.`);
            }
            return null;
        }
    });
    const _handlePrompt = (promptName_1, content_1, ...args_1) => __awaiter(void 0, [promptName_1, content_1, ...args_1], void 0, function* (promptName, content, options = {}) {
        const { output = 'console', includeTypes = true } = options;
        let finalPrompt = content;
        if (includeTypes) {
            finalPrompt += `\n\n👇 Useful TypeScript Definitions 👇\n\`\`\`typescript\n${typeContext_1.TYPE_CONTEXT}\n\`\`\`\n`;
        }
        if (output === 'error') {
            console.log(`⚠️ Throwing error to display [${promptName}] cleanly...`);
            throw new Error(finalPrompt);
        }
        console.log(finalPrompt);
    });
    // Helper to extract clean HTML for prompts
    const _getCleanHtml = (loc) => __awaiter(void 0, void 0, void 0, function* () {
        return loc.evaluate((el) => {
            const clone = el.cloneNode(true);
            // 1. Remove Heavy/Useless Elements
            const removeSelectors = 'script, style, svg, path, circle, rect, noscript, [hidden]';
            clone.querySelectorAll(removeSelectors).forEach(n => n.remove());
            // 2. Clean Attributes
            const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
            let currentNode = walker.currentNode;
            while (currentNode) {
                currentNode.removeAttribute('style'); // Inline styles are noise
                currentNode.removeAttribute('data-reactid');
                // 3. Condense Tailwind Classes (Heuristic)
                // If class string is very long (>50 chars), keep the first few tokens and truncate.
                // This preserves "MuiRow" but cuts "text-sm p-4 hover:bg-gray-50 ..."
                const cls = currentNode.getAttribute('class');
                if (cls && cls.length > 80) {
                    const tokens = cls.split(' ');
                    if (tokens.length > 5) {
                        currentNode.setAttribute('class', tokens.slice(0, 4).join(' ') + ' ...');
                    }
                }
                currentNode = walker.nextNode();
            }
            return clone.outerHTML;
        });
    });
    return {
        getHeaders: () => __awaiter(void 0, void 0, void 0, function* () { return Array.from((yield _getMap()).keys()); }),
        getHeaderCell: (columnName) => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield _getMap();
            const idx = map.get(columnName);
            if (idx === undefined)
                throw _createColumnError(columnName, map, 'header cell');
            return resolve(config.headerSelector, rootLocator).nth(idx);
        }),
        reset: () => __awaiter(void 0, void 0, void 0, function* () {
            logDebug("Resetting table...");
            const context = {
                root: rootLocator,
                config: config,
                page: rootLocator.page(),
                resolve: resolve
            };
            yield config.onReset(context);
            _hasPaginated = false;
            _headerMap = null;
            logDebug("Table reset complete.");
        }),
        getColumnValues: (column, options) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const map = yield _getMap();
            const colIdx = map.get(column);
            if (colIdx === undefined)
                throw _createColumnError(column, map);
            const mapper = (_a = options === null || options === void 0 ? void 0 : options.mapper) !== null && _a !== void 0 ? _a : ((c) => c.innerText());
            const effectiveMaxPages = (_b = options === null || options === void 0 ? void 0 : options.maxPages) !== null && _b !== void 0 ? _b : config.maxPages;
            let currentPage = 1;
            const results = [];
            logDebug(`Getting column values for '${column}' (Pages: ${effectiveMaxPages})`);
            while (true) {
                const rows = yield resolve(config.rowSelector, rootLocator).all();
                for (const row of rows) {
                    const cell = typeof config.cellSelector === 'string'
                        ? row.locator(config.cellSelector).nth(colIdx)
                        : resolve(config.cellSelector, row).nth(colIdx);
                    results.push(yield mapper(cell));
                }
                if (currentPage < effectiveMaxPages) {
                    const context = {
                        root: rootLocator, config, page: rootLocator.page(), resolve
                    };
                    if (yield config.pagination(context)) {
                        _hasPaginated = true;
                        currentPage++;
                        continue;
                    }
                }
                break;
            }
            return results;
        }),
        getByRow: (filters, options) => __awaiter(void 0, void 0, void 0, function* () {
            let row = yield _findRowLocator(filters, options);
            if (!row) {
                row = resolve(config.rowSelector, rootLocator).filter({ hasText: "___SENTINEL_ROW_NOT_FOUND___" + Date.now() });
            }
            const smartRow = _makeSmart(row, yield _getMap());
            if (options === null || options === void 0 ? void 0 : options.asJSON) {
                return smartRow.toJSON();
            }
            return smartRow;
        }),
        getAllRows: (options) => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield _getMap();
            let rowLocators = resolve(config.rowSelector, rootLocator);
            if (options === null || options === void 0 ? void 0 : options.filter) {
                rowLocators = _applyFilters(rowLocators, options.filter, map, options.exact || false);
            }
            const rows = yield rowLocators.all();
            const smartRows = rows.map(loc => _makeSmart(loc, map));
            if (options === null || options === void 0 ? void 0 : options.asJSON) {
                return Promise.all(smartRows.map(r => r.toJSON()));
            }
            return smartRows;
        }),
        generateConfigPrompt: (options) => __awaiter(void 0, void 0, void 0, function* () {
            const html = yield _getCleanHtml(rootLocator);
            const separator = "=".repeat(50);
            const content = `\n${separator}\n🤖 COPY INTO GEMINI/ChatGPT 🤖\n${separator}\nI am using 'playwright-smart-table'. Generate config for:\n\`\`\`html\n${html.substring(0, 10000)} ...\n\`\`\`\n${separator}\n`;
            yield _handlePrompt('Smart Table Config', content, options);
        }),
        generateStrategyPrompt: (options) => __awaiter(void 0, void 0, void 0, function* () {
            const container = rootLocator.locator('xpath=..');
            const html = yield _getCleanHtml(container);
            const content = `\n==================================================\n🤖 COPY INTO GEMINI/ChatGPT TO WRITE A STRATEGY 🤖\n==================================================\nI need a custom Pagination Strategy for 'playwright-smart-table'.\nContainer HTML:\n\`\`\`html\n${html.substring(0, 10000)} ...\n\`\`\`\n`;
            yield _handlePrompt('Smart Table Strategy', content, options);
        }),
    };
};
exports.useTable = useTable;
