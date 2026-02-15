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
exports.Strategies = exports.ResolutionStrategies = exports.CellNavigationStrategies = exports.HeaderStrategies = exports.FillStrategies = exports.DedupeStrategies = exports.SortingStrategies = exports.LoadingStrategies = exports.PaginationStrategies = exports.useTable = void 0;
const typeContext_1 = require("./typeContext");
const sorting_1 = require("./strategies/sorting");
const pagination_1 = require("./strategies/pagination");
const dedupe_1 = require("./strategies/dedupe");
const loading_1 = require("./strategies/loading");
const fill_1 = require("./strategies/fill");
Object.defineProperty(exports, "FillStrategies", { enumerable: true, get: function () { return fill_1.FillStrategies; } });
const headers_1 = require("./strategies/headers");
Object.defineProperty(exports, "HeaderStrategies", { enumerable: true, get: function () { return headers_1.HeaderStrategies; } });
const columns_1 = require("./strategies/columns");
Object.defineProperty(exports, "CellNavigationStrategies", { enumerable: true, get: function () { return columns_1.CellNavigationStrategies; } });
const smartRow_1 = require("./smartRow");
const filterEngine_1 = require("./filterEngine");
const tableMapper_1 = require("./engine/tableMapper");
const rowFinder_1 = require("./engine/rowFinder");
const resolution_1 = require("./strategies/resolution");
Object.defineProperty(exports, "ResolutionStrategies", { enumerable: true, get: function () { return resolution_1.ResolutionStrategies; } });
const strategies_1 = require("./strategies");
Object.defineProperty(exports, "Strategies", { enumerable: true, get: function () { return strategies_1.Strategies; } });
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
        loading: {
            isHeaderLoading: loading_1.LoadingStrategies.Headers.stable(200)
        }
    };
    const config = Object.assign(Object.assign({ rowSelector: "tbody tr", headerSelector: "thead th", cellSelector: "td", maxPages: 1, headerTransformer: ({ text }) => text, autoScroll: true, onReset: () => __awaiter(void 0, void 0, void 0, function* () { }) }, configOptions), { strategies: Object.assign(Object.assign({}, defaultStrategies), configOptions.strategies) });
    const resolve = (item, parent) => {
        if (typeof item === 'string')
            return parent.locator(item);
        if (typeof item === 'function')
            return item(parent);
        return item;
    };
    // Internal State
    let _hasPaginated = false;
    // Helpers
    const log = (msg) => {
        (0, debugUtils_1.logDebug)(config, 'verbose', msg);
    };
    const _createColumnError = (colName, map, context) => {
        const availableColumns = Array.from(map.keys());
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
            suggestion = `. Available columns (first 10 of ${availableColumns.length}): ${availableColumns.slice(0, 10).map(c => `"${c}"`).join(', ')}, ...`;
        }
        const contextMsg = context ? ` (${context})` : '';
        return new Error(`Column "${colName}" not found${contextMsg}${suggestion}`);
    };
    // Engines
    const filterEngine = new filterEngine_1.FilterEngine(config, resolve);
    const tableMapper = new tableMapper_1.TableMapper(rootLocator, config, resolve);
    // Placeholder for the final table object
    let finalTable = null;
    // Helper factory
    const _makeSmart = (rowLocator, map, rowIndex) => {
        return (0, smartRow_1.createSmartRow)(rowLocator, map, rowIndex, config, rootLocator, resolve, finalTable);
    };
    const rowFinder = new rowFinder_1.RowFinder(rootLocator, config, resolve, filterEngine, tableMapper, _makeSmart);
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
        yield tableMapper.getMap();
    });
    const result = {
        init: (options) => __awaiter(void 0, void 0, void 0, function* () {
            if (tableMapper.isInitialized())
                return result;
            (0, debugUtils_1.warnIfDebugInCI)(config);
            (0, debugUtils_1.logDebug)(config, 'info', 'Initializing table');
            const map = yield tableMapper.getMap(options === null || options === void 0 ? void 0 : options.timeout);
            (0, debugUtils_1.logDebug)(config, 'info', `Table initialized with ${map.size} columns`, Array.from(map.keys()));
            yield (0, debugUtils_1.debugDelay)(config, 'default');
            return result;
        }),
        scrollToColumn: (columnName) => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield tableMapper.getMap();
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
            const map = yield tableMapper.getMap();
            return Array.from(map.keys());
        }),
        getHeaderCell: (columnName) => __awaiter(void 0, void 0, void 0, function* () {
            const map = yield tableMapper.getMap();
            const idx = map.get(columnName);
            if (idx === undefined)
                throw _createColumnError(columnName, map, 'header cell');
            return resolve(config.headerSelector, rootLocator).nth(idx);
        }),
        reset: () => __awaiter(void 0, void 0, void 0, function* () {
            log("Resetting table...");
            const context = { root: rootLocator, config, page: rootLocator.page(), resolve };
            yield config.onReset(context);
            _hasPaginated = false;
            tableMapper.clear();
            log("Table reset complete.");
        }),
        revalidate: () => __awaiter(void 0, void 0, void 0, function* () {
            log("Revalidating table structure...");
            yield tableMapper.remapHeaders();
            log("Table revalidated.");
        }),
        getColumnValues: (column, options) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const map = yield tableMapper.getMap();
            const colIdx = map.get(column);
            if (colIdx === undefined)
                throw _createColumnError(column, map);
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
            const map = tableMapper.getMapSync();
            if (!map)
                throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.getRows() which auto-initialize.');
            const allRows = resolve(config.rowSelector, rootLocator);
            const matchedRows = filterEngine.applyFilters(allRows, filters, map, options.exact || false, rootLocator.page());
            const rowLocator = matchedRows.first();
            return _makeSmart(rowLocator, map, 0); // fallback index 0
        },
        getRowByIndex: (index, options = {}) => {
            const map = tableMapper.getMapSync();
            if (!map)
                throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.getRows() which auto-initialize.');
            const rowLocator = resolve(config.rowSelector, rootLocator).nth(index);
            return _makeSmart(rowLocator, map, index);
        },
        findRow: (filters, options) => __awaiter(void 0, void 0, void 0, function* () {
            // @ts-ignore
            return rowFinder.findRow(filters, options);
        }),
        getRows: (options) => __awaiter(void 0, void 0, void 0, function* () {
            console.warn('DEPRECATED: table.getRows() is deprecated and will be removed in a future version. Use table.findRows() instead.');
            // @ts-ignore
            return rowFinder.findRows((options === null || options === void 0 ? void 0 : options.filter) || {}, Object.assign(Object.assign({}, options), { maxPages: 1 }));
        }),
        findRows: (filters, options) => __awaiter(void 0, void 0, void 0, function* () {
            return rowFinder.findRows(filters, options);
        }),
        isInitialized: () => {
            return tableMapper.isInitialized();
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
            var _a, _b, _c, _d, _e, _f, _g;
            yield _ensureInitialized();
            const paginationStrategy = (_a = options === null || options === void 0 ? void 0 : options.pagination) !== null && _a !== void 0 ? _a : config.strategies.pagination;
            const hasPaginationInOptions = (options === null || options === void 0 ? void 0 : options.pagination) !== undefined;
            if (!hasPaginationInOptions && !hasPaginationInConfig)
                throw new Error('No pagination strategy provided.');
            yield result.reset();
            yield result.init();
            const map = tableMapper.getMapSync();
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
            const autoFlatten = (_e = options === null || options === void 0 ? void 0 : options.autoFlatten) !== null && _e !== void 0 ? _e : false;
            let index = 0;
            let paginationResult = true;
            let seenKeys = null;
            let batchRows = [];
            let batchStartIndex = 0;
            log(`Starting iterateThroughTable (maxIterations: ${effectiveMaxIterations}, batchSize: ${batchSize !== null && batchSize !== void 0 ? batchSize : 'none'})`);
            while (index < effectiveMaxIterations) {
                const rowLocators = yield resolve(config.rowSelector, rootLocator).all();
                const smartRowsArray = [];
                const isRowLoading = (_f = config.strategies.loading) === null || _f === void 0 ? void 0 : _f.isRowLoading;
                for (let i = 0; i < rowLocators.length; i++) {
                    const smartRow = _makeSmart(rowLocators[i], map, i);
                    if (isRowLoading && (yield isRowLoading(smartRow)))
                        continue;
                    smartRowsArray.push(smartRow);
                }
                let rows = (0, smartRowArray_1.createSmartRowArray)(smartRowsArray);
                const dedupeStrategy = (_g = options === null || options === void 0 ? void 0 : options.dedupeStrategy) !== null && _g !== void 0 ? _g : config.strategies.dedupe;
                if (dedupeStrategy && rows.length > 0) {
                    if (!seenKeys)
                        seenKeys = new Set();
                    const deduplicated = [];
                    for (const row of rows) {
                        const key = yield dedupeStrategy(row);
                        if (!seenKeys.has(key)) {
                            seenKeys.add(key);
                            deduplicated.push(row);
                        }
                    }
                    rows = (0, smartRowArray_1.createSmartRowArray)(deduplicated);
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
                        yield options.beforeFirst({ index: callbackIndex, rows: (0, smartRowArray_1.createSmartRowArray)(callbackRows), allData });
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
                        rows: (0, smartRowArray_1.createSmartRowArray)(callbackRows),
                        allData,
                        table: restrictedTable,
                        batchInfo
                    });
                    if (autoFlatten && Array.isArray(returnValue)) {
                        allData.push(...returnValue);
                    }
                    else {
                        allData.push(returnValue);
                    }
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
                        yield options.afterLast({ index: callbackIndex, rows: (0, smartRowArray_1.createSmartRowArray)(callbackRows), allData });
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
                            yield options.beforeFirst({ index: callbackIndex, rows: (0, smartRowArray_1.createSmartRowArray)(batchRows), allData });
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
                            rows: (0, smartRowArray_1.createSmartRowArray)(batchRows),
                            allData,
                            table: restrictedTable,
                            batchInfo
                        });
                        if (autoFlatten && Array.isArray(returnValue)) {
                            allData.push(...returnValue);
                        }
                        else {
                            allData.push(returnValue);
                        }
                        if (options === null || options === void 0 ? void 0 : options.afterLast) {
                            yield options.afterLast({ index: callbackIndex, rows: (0, smartRowArray_1.createSmartRowArray)(batchRows), allData });
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
            const content = `\n${separator} \n🤖 COPY INTO GEMINI / ChatGPT 🤖\n${separator} \nI am using 'playwright-smart-table'.\nTarget Table Locator: ${rootLocator.toString()} \nGenerate config for: \n\`\`\`html\n${html.substring(0, 10000)} ...\n\`\`\`\n${separator}\n`;
            yield _handlePrompt('Smart Table Config', content, options);
        }),
    };
    finalTable = result;
    return result;
};
exports.useTable = useTable;
exports.PaginationStrategies = Object.assign({}, pagination_1.PaginationStrategies);
exports.LoadingStrategies = loading_1.LoadingStrategies;
exports.SortingStrategies = sorting_1.SortingStrategies;
exports.DedupeStrategies = dedupe_1.DedupeStrategies;
