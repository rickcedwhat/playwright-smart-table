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
exports.Strategies = exports.ResolutionStrategies = exports.CellNavigationStrategies = exports.HeaderStrategies = exports.FillStrategies = exports.SortingStrategies = exports.PaginationStrategies = exports.useTable = void 0;
const typeContext_1 = require("./typeContext");
const sorting_1 = require("./strategies/sorting");
const pagination_1 = require("./strategies/pagination");
const fill_1 = require("./strategies/fill");
Object.defineProperty(exports, "FillStrategies", { enumerable: true, get: function () { return fill_1.FillStrategies; } });
const headers_1 = require("./strategies/headers");
Object.defineProperty(exports, "HeaderStrategies", { enumerable: true, get: function () { return headers_1.HeaderStrategies; } });
const columns_1 = require("./strategies/columns");
Object.defineProperty(exports, "CellNavigationStrategies", { enumerable: true, get: function () { return columns_1.CellNavigationStrategies; } });
const smartRow_1 = require("./smartRow");
const filterEngine_1 = require("./filterEngine");
const resolution_1 = require("./strategies/resolution");
Object.defineProperty(exports, "ResolutionStrategies", { enumerable: true, get: function () { return resolution_1.ResolutionStrategies; } });
const strategies_1 = require("./strategies");
Object.defineProperty(exports, "Strategies", { enumerable: true, get: function () { return strategies_1.Strategies; } });
const validation_1 = require("./strategies/validation");
const debugUtils_1 = require("./utils/debugUtils");
const smartRowArray_1 = require("./utils/smartRowArray");
/**
 * Main hook to interact with a table.
 */
const useTable = (rootLocator, configOptions = {}) => {
    var _a;
    // Store whether pagination was explicitly provided in config
    const hasPaginationInConfig = ((_a = configOptions.strategies) === null || _a === void 0 ? void 0 : _a.pagination) !== undefined;
    // Default strategies
    const defaultStrategies = {
        fill: fill_1.FillStrategies.default,
        header: headers_1.HeaderStrategies.visible,
        cellNavigation: columns_1.CellNavigationStrategies.default,
        pagination: () => __awaiter(void 0, void 0, void 0, function* () { return false; }),
    };
    const config = Object.assign(Object.assign({ rowSelector: "tbody tr", headerSelector: "thead th", cellSelector: "td", maxPages: 1, headerTransformer: ({ text, index, locator }) => text, autoScroll: true, onReset: () => __awaiter(void 0, void 0, void 0, function* () { }) }, configOptions), { strategies: Object.assign(Object.assign({}, defaultStrategies), configOptions.strategies) });
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
    let _isInitialized = false;
    // Helpers
    const log = (msg) => {
        (0, debugUtils_1.logDebug)(config, 'verbose', msg); // Legacy(`🔎 [SmartTable Debug] ${msg}`);
    };
    const _createColumnError = (colName, map, context) => {
        const availableColumns = Array.from(map.keys());
        // Use Suggestion Logic from ResolutionStrategy (if we had a fuzzy one, for now manual suggest)
        const lowerCol = colName.toLowerCase();
        const suggestions = availableColumns.filter(col => col.toLowerCase().includes(lowerCol) ||
            lowerCol.includes(col.toLowerCase()) ||
            col.toLowerCase().replace(/\s+/g, '') === lowerCol.replace(/\s+/g, ''));
        let suggestion = '.';
        if (suggestions.length > 0 && suggestions[0] !== colName) {
            suggestion = `. Did you mean "${suggestions[0]}"?`;
        }
        else if (availableColumns.length > 0 && availableColumns.length <= 10) {
            suggestion = `. Available columns: ${availableColumns.map(c => `"${c}"`).join(', ')}`;
        }
        else if (availableColumns.length > 0) {
            suggestion = `. Available columns (first 5): ${availableColumns.slice(0, 5).map(c => `"${c}"`).join(', ')}, ...`;
        }
        const contextMsg = context ? ` (${context})` : '';
        return new Error(`Column "${colName}" not found${contextMsg}${suggestion}`);
    };
    const _getMap = (timeout) => __awaiter(void 0, void 0, void 0, function* () {
        if (_headerMap)
            return _headerMap;
        log('Mapping headers...');
        const headerTimeout = timeout !== null && timeout !== void 0 ? timeout : 3000;
        if (config.autoScroll) {
            try {
                yield rootLocator.scrollIntoViewIfNeeded({ timeout: 1000 });
            }
            catch (e) { }
        }
        const headerLoc = resolve(config.headerSelector, rootLocator);
        try {
            yield headerLoc.first().waitFor({ state: 'visible', timeout: headerTimeout });
        }
        catch (e) { /* Ignore hydration */ }
        const strategy = config.strategies.header || headers_1.HeaderStrategies.visible;
        const context = {
            root: rootLocator,
            config: config,
            page: rootLocator.page(),
            resolve: resolve
        };
        const rawHeaders = yield strategy(context);
        const entries = yield Promise.all(rawHeaders.map((t, i) => __awaiter(void 0, void 0, void 0, function* () {
            let text = t.trim() || `__col_${i}`;
            if (config.headerTransformer) {
                text = yield config.headerTransformer({
                    text,
                    index: i,
                    locator: rootLocator.locator(config.headerSelector).nth(i)
                });
            }
            return [text, i];
        })));
        // Validation: Check for empty table
        if (entries.length === 0) {
            throw new Error(`Initialization Error: No columns found using selector "${config.headerSelector}". Check your selector or ensure the table is visible.`);
        }
        // Validation: Check for duplicates
        const seen = new Set();
        const duplicates = new Set();
        for (const [name] of entries) {
            if (seen.has(name)) {
                duplicates.add(name);
            }
            seen.add(name);
        }
        if (duplicates.size > 0) {
            const dupList = Array.from(duplicates).map(d => `"${d}"`).join(', ');
            throw new Error(`Initialization Error: Duplicate column names found: ${dupList}. Use 'headerTransformer' to rename duplicate columns.`);
        }
        _headerMap = new Map(entries);
        log(`Mapped ${entries.length} columns: ${JSON.stringify(entries.map(e => e[0]))}`);
        return _headerMap;
    });
    // Placeholder for the final table object
    let finalTable = null;
    const filterEngine = new filterEngine_1.FilterEngine(config, resolve);
    // Helper factory
    const _makeSmart = (rowLocator, map, rowIndex) => {
        // Use the wrapped SmartRow logic
        return (0, smartRow_1.createSmartRow)(rowLocator, map, rowIndex, config, rootLocator, resolve, finalTable);
    };
    const _findRowLocator = (filters_1, ...args_1) => __awaiter(void 0, [filters_1, ...args_1], void 0, function* (filters, options = {}) {
        var _a;
        const map = yield _getMap();
        const effectiveMaxPages = (_a = options.maxPages) !== null && _a !== void 0 ? _a : config.maxPages;
        let currentPage = 1;
        log(`Looking for row: ${JSON.stringify(filters)} (MaxPages: ${effectiveMaxPages})`);
        while (true) {
            const allRows = resolve(config.rowSelector, rootLocator);
            // Use FilterEngine
            const matchedRows = filterEngine.applyFilters(allRows, filters, map, options.exact || false, rootLocator.page());
            const count = yield matchedRows.count();
            log(`Page ${currentPage}: Found ${count} matches.`);
            if (count > 1) {
                // Sample data logic (simplified for refactor, kept inline or moved to util if needed)
                const sampleData = [];
                try {
                    const firstFewRows = yield matchedRows.all();
                    const sampleCount = Math.min(firstFewRows.length, 3);
                    for (let i = 0; i < sampleCount; i++) {
                        const rowData = yield _makeSmart(firstFewRows[i], map).toJSON();
                        sampleData.push(JSON.stringify(rowData));
                    }
                }
                catch (e) { }
                const sampleMsg = sampleData.length > 0 ? `\nSample matching rows:\n${sampleData.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}` : '';
                throw new Error(`Strict Mode Violation: Found ${count} rows matching ${JSON.stringify(filters)} on page ${currentPage}. ` +
                    `Expected exactly one match. Try adding more filters to make your query unique.${sampleMsg}`);
            }
            if (count === 1)
                return matchedRows.first();
            if (currentPage < effectiveMaxPages) {
                log(`Page ${currentPage}: Not found. Attempting pagination...`);
                const context = {
                    root: rootLocator,
                    config: config,
                    page: rootLocator.page(),
                    resolve: resolve
                };
                const paginationResult = yield config.strategies.pagination(context);
                const didLoadMore = (0, validation_1.validatePaginationResult)(paginationResult, 'Pagination Strategy');
                if (didLoadMore) {
                    _hasPaginated = true;
                    currentPage++;
                    continue;
                }
                else {
                    log(`Page ${currentPage}: Pagination failed (end of data).`);
                }
            }
            if (_hasPaginated) {
                console.warn(`⚠️ [SmartTable] Row not found. The table has been paginated (Current Page: ${currentPage}). You may need to call 'await table.reset()' if the target row is on a previous page.`);
            }
            return null;
        }
    });
    const _getCleanHtml = (loc) => __awaiter(void 0, void 0, void 0, function* () {
        return loc.evaluate((el) => {
            const clone = el.cloneNode(true);
            const removeSelectors = 'script, style, svg, path, circle, rect, noscript, [hidden]';
            clone.querySelectorAll(removeSelectors).forEach(n => n.remove());
            const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
            let currentNode = walker.currentNode;
            while (currentNode) {
                currentNode.removeAttribute('style');
                currentNode.removeAttribute('data-reactid');
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
    const _ensureInitialized = () => __awaiter(void 0, void 0, void 0, function* () {
        if (!_isInitialized) {
            yield _getMap();
            _isInitialized = true;
        }
    });
    const result = {
        init: (options) => __awaiter(void 0, void 0, void 0, function* () {
            if (_isInitialized && _headerMap)
                return result;
            (0, debugUtils_1.warnIfDebugInCI)(config);
            (0, debugUtils_1.logDebug)(config, 'info', 'Initializing table');
            yield _getMap(options === null || options === void 0 ? void 0 : options.timeout);
            _isInitialized = true;
            if (_headerMap) {
                (0, debugUtils_1.logDebug)(config, 'info', `Table initialized with ${_headerMap.size} columns`, Array.from(_headerMap.keys()));
                // Trace event removed - redundant with debug logging
            }
            yield (0, debugUtils_1.debugDelay)(config, 'default');
            return result;
        }),
        scrollToColumn: (columnName) => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield _getMap();
            const idx = map.get(columnName);
            if (idx === undefined)
                throw _createColumnError(columnName, map);
            yield config.strategies.cellNavigation({
                config: config,
                root: rootLocator,
                page: rootLocator.page(),
                resolve,
                column: columnName,
                index: idx
            });
        }),
        getHeaders: () => __awaiter(void 0, void 0, void 0, function* () {
            if (!_isInitialized || !_headerMap)
                throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.getRows() which auto-initialize.');
            return Array.from(_headerMap.keys());
        }),
        getHeaderCell: (columnName) => __awaiter(void 0, void 0, void 0, function* () {
            if (!_isInitialized || !_headerMap)
                throw new Error('Table not initialized. Call await table.init() first.');
            const idx = _headerMap.get(columnName);
            if (idx === undefined)
                throw _createColumnError(columnName, _headerMap, 'header cell');
            return resolve(config.headerSelector, rootLocator).nth(idx);
        }),
        reset: () => __awaiter(void 0, void 0, void 0, function* () {
            log("Resetting table...");
            const context = { root: rootLocator, config, page: rootLocator.page(), resolve };
            yield config.onReset(context);
            _hasPaginated = false;
            _headerMap = null;
            _isInitialized = false;
            log("Table reset complete.");
        }),
        revalidate: () => __awaiter(void 0, void 0, void 0, function* () {
            log("Revalidating table structure...");
            _headerMap = null; // Clear the map to force re-scanning
            yield _getMap(); // Re-scan headers
            log("Table revalidated.");
        }),
        getColumnValues: (column, options) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            yield _ensureInitialized();
            const colIdx = _headerMap.get(column);
            if (colIdx === undefined)
                throw _createColumnError(column, _headerMap);
            const mapper = (_a = options === null || options === void 0 ? void 0 : options.mapper) !== null && _a !== void 0 ? _a : ((c) => c.innerText());
            const effectiveMaxPages = (_b = options === null || options === void 0 ? void 0 : options.maxPages) !== null && _b !== void 0 ? _b : config.maxPages;
            let currentPage = 1;
            const results = [];
            log(`Getting column values for '${column}' (Pages: ${effectiveMaxPages})`);
            while (true) {
                const rows = yield resolve(config.rowSelector, rootLocator).all();
                for (const row of rows) {
                    const cell = typeof config.cellSelector === 'string'
                        ? row.locator(config.cellSelector).nth(colIdx)
                        : resolve(config.cellSelector, row).nth(colIdx);
                    results.push(yield mapper(cell));
                }
                if (currentPage < effectiveMaxPages) {
                    const context = { root: rootLocator, config, page: rootLocator.page(), resolve };
                    if (yield config.strategies.pagination(context)) {
                        _hasPaginated = true;
                        currentPage++;
                        continue;
                    }
                }
                break;
            }
            return results;
        }),
        getRow: (filters, options = { exact: false }) => {
            if (!_isInitialized || !_headerMap)
                throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.getRows() which auto-initialize.');
            const allRows = resolve(config.rowSelector, rootLocator);
            const matchedRows = filterEngine.applyFilters(allRows, filters, _headerMap, options.exact || false, rootLocator.page());
            const rowLocator = matchedRows.first();
            return _makeSmart(rowLocator, _headerMap, 0); // fallback index 0
        },
        getRowByIndex: (index, options = {}) => {
            if (!_isInitialized || !_headerMap)
                throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.getRows() which auto-initialize.');
            const rowIndex = index - 1; // Convert 1-based to 0-based
            const rowLocator = resolve(config.rowSelector, rootLocator).nth(rowIndex);
            return _makeSmart(rowLocator, _headerMap, rowIndex);
        },
        findRow: (filters, options) => __awaiter(void 0, void 0, void 0, function* () {
            (0, debugUtils_1.logDebug)(config, 'info', 'Searching for row', filters);
            yield _ensureInitialized();
            let row = yield _findRowLocator(filters, options);
            if (row) {
                (0, debugUtils_1.logDebug)(config, 'info', 'Row found');
                yield (0, debugUtils_1.debugDelay)(config, 'findRow');
                return _makeSmart(row, _headerMap, 0);
            }
            (0, debugUtils_1.logDebug)(config, 'error', 'Row not found', filters);
            yield (0, debugUtils_1.debugDelay)(config, 'findRow');
            // Return sentinel row
            row = resolve(config.rowSelector, rootLocator).filter({ hasText: "___SENTINEL_ROW_NOT_FOUND___" + Date.now() });
            return _makeSmart(row, _headerMap, 0);
        }),
        getRows: (options) => __awaiter(void 0, void 0, void 0, function* () {
            yield _ensureInitialized();
            let rowLocators = resolve(config.rowSelector, rootLocator);
            if (options === null || options === void 0 ? void 0 : options.filter) {
                rowLocators = filterEngine.applyFilters(rowLocators, options.filter, _headerMap, options.exact || false, rootLocator.page());
            }
            const rows = yield rowLocators.all();
            const smartRows = rows.map((loc, i) => _makeSmart(loc, _headerMap, i));
            return (0, smartRowArray_1.createSmartRowArray)(smartRows);
        }),
        findRows: (filters, options) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            yield _ensureInitialized();
            const allRows = [];
            const effectiveMaxPages = (_b = (_a = options === null || options === void 0 ? void 0 : options.maxPages) !== null && _a !== void 0 ? _a : config.maxPages) !== null && _b !== void 0 ? _b : Infinity;
            let pageCount = 0;
            // Collect rows from current page
            let rowLocators = resolve(config.rowSelector, rootLocator);
            rowLocators = filterEngine.applyFilters(rowLocators, filters, _headerMap, (_c = options === null || options === void 0 ? void 0 : options.exact) !== null && _c !== void 0 ? _c : false, rootLocator.page());
            let rows = yield rowLocators.all();
            allRows.push(...rows.map((loc, i) => _makeSmart(loc, _headerMap, i)));
            // Paginate and collect more rows
            while (pageCount < effectiveMaxPages && config.strategies.pagination) {
                const paginationResult = yield config.strategies.pagination({
                    root: rootLocator,
                    config,
                    resolve,
                    page: rootLocator.page()
                });
                const didPaginate = (0, validation_1.validatePaginationResult)(paginationResult, 'Pagination Strategy');
                if (!didPaginate)
                    break;
                pageCount++;
                _hasPaginated = true;
                // Collect rows from new page
                rowLocators = resolve(config.rowSelector, rootLocator);
                rowLocators = filterEngine.applyFilters(rowLocators, filters, _headerMap, (_d = options === null || options === void 0 ? void 0 : options.exact) !== null && _d !== void 0 ? _d : false, rootLocator.page());
                rows = yield rowLocators.all();
                allRows.push(...rows.map((loc, i) => _makeSmart(loc, _headerMap, i)));
            }
            if (options === null || options === void 0 ? void 0 : options.asJSON) {
                return Promise.all(allRows.map(r => r.toJSON()));
            }
            return allRows;
        }),
        isInitialized: () => {
            return _isInitialized;
        },
        sorting: {
            apply: (columnName, direction) => __awaiter(void 0, void 0, void 0, function* () {
                yield _ensureInitialized();
                if (!config.strategies.sorting)
                    throw new Error('No sorting strategy has been configured.');
                log(`Applying sort for column "${columnName}" (${direction})`);
                const context = { root: rootLocator, config, page: rootLocator.page(), resolve };
                yield config.strategies.sorting.doSort({ columnName, direction, context });
            }),
            getState: (columnName) => __awaiter(void 0, void 0, void 0, function* () {
                yield _ensureInitialized();
                if (!config.strategies.sorting)
                    throw new Error('No sorting strategy has been configured.');
                const context = { root: rootLocator, config, page: rootLocator.page(), resolve };
                return config.strategies.sorting.getSortState({ columnName, context });
            })
        },
        iterateThroughTable: (callback, options) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            yield _ensureInitialized();
            const paginationStrategy = (_a = options === null || options === void 0 ? void 0 : options.pagination) !== null && _a !== void 0 ? _a : config.strategies.pagination;
            const hasPaginationInOptions = (options === null || options === void 0 ? void 0 : options.pagination) !== undefined;
            if (!hasPaginationInOptions && !hasPaginationInConfig)
                throw new Error('No pagination strategy provided.');
            yield result.reset();
            yield result.init();
            const restrictedTable = {
                init: result.init,
                getHeaders: result.getHeaders,
                getHeaderCell: result.getHeaderCell,
                getRow: result.getRow,
                getRowByIndex: result.getRowByIndex,
                findRow: result.findRow,
                getRows: result.getRows,
                findRows: result.findRows,
                getColumnValues: result.getColumnValues,
                isInitialized: result.isInitialized,
                sorting: result.sorting,
                scrollToColumn: result.scrollToColumn,
                revalidate: result.revalidate,
                generateConfigPrompt: result.generateConfigPrompt,
            };
            const getIsFirst = (_b = options === null || options === void 0 ? void 0 : options.getIsFirst) !== null && _b !== void 0 ? _b : (({ index }) => index === 0);
            const getIsLast = (_c = options === null || options === void 0 ? void 0 : options.getIsLast) !== null && _c !== void 0 ? _c : (() => false);
            const allData = [];
            const effectiveMaxIterations = (_d = options === null || options === void 0 ? void 0 : options.maxIterations) !== null && _d !== void 0 ? _d : config.maxPages;
            const batchSize = options === null || options === void 0 ? void 0 : options.batchSize;
            const isBatching = batchSize !== undefined && batchSize > 1;
            let index = 0;
            let paginationResult = true;
            let seenKeys = null;
            let batchRows = [];
            let batchStartIndex = 0;
            log(`Starting iterateThroughTable (maxIterations: ${effectiveMaxIterations}, batchSize: ${batchSize !== null && batchSize !== void 0 ? batchSize : 'none'})`);
            while (index < effectiveMaxIterations) {
                const rowLocators = yield resolve(config.rowSelector, rootLocator).all();
                let rows = rowLocators.map((loc, i) => _makeSmart(loc, _headerMap, i));
                if ((options === null || options === void 0 ? void 0 : options.dedupeStrategy) && rows.length > 0) {
                    if (!seenKeys)
                        seenKeys = new Set();
                    const deduplicated = [];
                    for (const row of rows) {
                        const key = yield options.dedupeStrategy(row);
                        if (!seenKeys.has(key)) {
                            seenKeys.add(key);
                            deduplicated.push(row);
                        }
                    }
                    rows = deduplicated;
                    log(`Deduplicated ${rowLocators.length} rows to ${rows.length} unique rows (total seen: ${seenKeys.size})`);
                }
                // Add rows to batch if batching is enabled
                if (isBatching) {
                    batchRows.push(...rows);
                }
                const isLastIteration = index === effectiveMaxIterations - 1;
                // Determine if we should invoke the callback
                const batchComplete = isBatching && (index - batchStartIndex + 1) >= batchSize;
                const shouldInvokeCallback = !isBatching || batchComplete || isLastIteration;
                if (shouldInvokeCallback) {
                    const callbackRows = isBatching ? batchRows : rows;
                    const callbackIndex = isBatching ? batchStartIndex : index;
                    const isFirst = getIsFirst({ index: callbackIndex });
                    let isLast = getIsLast({ index: callbackIndex, paginationResult });
                    const isLastDueToMax = index === effectiveMaxIterations - 1;
                    if (isFirst && (options === null || options === void 0 ? void 0 : options.beforeFirst)) {
                        yield options.beforeFirst({ index: callbackIndex, rows: callbackRows, allData });
                    }
                    const batchInfo = isBatching ? {
                        startIndex: batchStartIndex,
                        endIndex: index,
                        size: index - batchStartIndex + 1
                    } : undefined;
                    const returnValue = yield callback({
                        index: callbackIndex,
                        isFirst,
                        isLast,
                        rows: callbackRows,
                        allData,
                        table: restrictedTable,
                        batchInfo
                    });
                    allData.push(returnValue);
                    // Determine if this is truly the last iteration
                    let finalIsLast = isLastDueToMax;
                    if (!isLastIteration) {
                        const context = { root: rootLocator, config, page: rootLocator.page(), resolve };
                        paginationResult = yield paginationStrategy(context);
                        (0, debugUtils_1.logDebug)(config, 'info', `Pagination ${paginationResult ? 'succeeded' : 'failed'}`);
                        yield (0, debugUtils_1.debugDelay)(config, 'pagination');
                        finalIsLast = getIsLast({ index: callbackIndex, paginationResult }) || !paginationResult;
                    }
                    if (finalIsLast && (options === null || options === void 0 ? void 0 : options.afterLast)) {
                        yield options.afterLast({ index: callbackIndex, rows: callbackRows, allData });
                    }
                    if (finalIsLast || !paginationResult) {
                        log(`Reached last iteration (index: ${index}, paginationResult: ${paginationResult})`);
                        break;
                    }
                    // Reset batch
                    if (isBatching) {
                        batchRows = [];
                        batchStartIndex = index + 1;
                    }
                }
                else {
                    // Continue paginating even when batching
                    const context = { root: rootLocator, config, page: rootLocator.page(), resolve };
                    paginationResult = yield paginationStrategy(context);
                    (0, debugUtils_1.logDebug)(config, 'info', `Pagination ${paginationResult ? 'succeeded' : 'failed'} (batching mode)`);
                    yield (0, debugUtils_1.debugDelay)(config, 'pagination');
                    if (!paginationResult) {
                        // Pagination failed, invoke callback with current batch
                        const callbackIndex = batchStartIndex;
                        const isFirst = getIsFirst({ index: callbackIndex });
                        const isLast = true;
                        if (isFirst && (options === null || options === void 0 ? void 0 : options.beforeFirst)) {
                            yield options.beforeFirst({ index: callbackIndex, rows: batchRows, allData });
                        }
                        const batchInfo = {
                            startIndex: batchStartIndex,
                            endIndex: index,
                            size: index - batchStartIndex + 1
                        };
                        const returnValue = yield callback({
                            index: callbackIndex,
                            isFirst,
                            isLast,
                            rows: batchRows,
                            allData,
                            table: restrictedTable,
                            batchInfo
                        });
                        allData.push(returnValue);
                        if (options === null || options === void 0 ? void 0 : options.afterLast) {
                            yield options.afterLast({ index: callbackIndex, rows: batchRows, allData });
                        }
                        log(`Pagination failed mid-batch (index: ${index})`);
                        break;
                    }
                }
                index++;
                log(`Iteration ${index} completed, continuing...`);
            }
            log(`iterateThroughTable completed after ${index + 1} iterations, collected ${allData.length} items`);
            return allData;
        }),
        generateConfigPrompt: (options) => __awaiter(void 0, void 0, void 0, function* () {
            const html = yield _getCleanHtml(rootLocator);
            const separator = "=".repeat(50);
            const content = `\n${separator}\n🤖 COPY INTO GEMINI/ChatGPT 🤖\n${separator}\nI am using 'playwright-smart-table'.\nTarget Table Locator: ${rootLocator.toString()}\nGenerate config for:\n\`\`\`html\n${html.substring(0, 10000)} ...\n\`\`\`\n${separator}\n`;
            yield _handlePrompt('Smart Table Config', content, options);
        }),
    };
    finalTable = result;
    return result;
};
exports.useTable = useTable;
exports.PaginationStrategies = pagination_1.PaginationStrategies;
exports.SortingStrategies = sorting_1.SortingStrategies;
