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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTable = void 0;
const minimalConfigContext_1 = require("./minimalConfigContext");
const validation_1 = require("./strategies/validation");
const loading_1 = require("./strategies/loading");
const fill_1 = require("./strategies/fill");
const headers_1 = require("./strategies/headers");
const smartRow_1 = require("./smartRow");
const filterEngine_1 = require("./filterEngine");
const tableMapper_1 = require("./engine/tableMapper");
const rowFinder_1 = require("./engine/rowFinder");
const tableIteration_1 = require("./engine/tableIteration");
const debugUtils_1 = require("./utils/debugUtils");
const smartRowArray_1 = require("./utils/smartRowArray");
const elementTracker_1 = require("./utils/elementTracker");
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
        pagination: {},
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
    const _makeSmart = (rowLocator, map, rowIndex, tablePageIndex) => {
        return (0, smartRow_1.createSmartRow)(rowLocator, map, rowIndex, config, rootLocator, resolve, finalTable, tablePageIndex);
    };
    const tableState = { currentPageIndex: 0 };
    const rowFinder = new rowFinder_1.RowFinder(rootLocator, config, resolve, filterEngine, tableMapper, _makeSmart, tableState);
    /** Builds a full TableContext/StrategyContext with getHeaderCell, getHeaders, scrollToColumn. Set after result is created. */
    let createStrategyContext = () => ({ root: rootLocator, config, page: rootLocator.page(), resolve });
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
    const _handlePrompt = (promptName, content) => __awaiter(void 0, void 0, void 0, function* () {
        let finalPrompt = content;
        finalPrompt += `\n\n👇 Useful TypeScript Definitions 👇\n\`\`\`typescript\n${minimalConfigContext_1.MINIMAL_CONFIG_CONTEXT}\n\`\`\`\n`;
        console.log(`⚠️ Throwing error to display [${promptName}] cleanly...`);
        throw new Error(finalPrompt);
    });
    const _autoInit = () => __awaiter(void 0, void 0, void 0, function* () {
        yield tableMapper.getMap();
    });
    // Default: goNext (one page). Pass useBulk true to prefer goNextBulk. "How far" uses numeric return when strategy provides it.
    const _advancePage = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (useBulk = false) {
        const context = createStrategyContext();
        const pagination = config.strategies.pagination;
        let rawResult;
        if (useBulk && (pagination === null || pagination === void 0 ? void 0 : pagination.goNextBulk)) {
            rawResult = yield pagination.goNextBulk(context);
        }
        else if (pagination === null || pagination === void 0 ? void 0 : pagination.goNext) {
            rawResult = yield pagination.goNext(context);
        }
        else if (pagination === null || pagination === void 0 ? void 0 : pagination.goNextBulk) {
            rawResult = yield pagination.goNextBulk(context);
        }
        const didAdvance = rawResult !== undefined && (0, validation_1.validatePaginationResult)(rawResult, 'Pagination Strategy');
        const pagesJumped = typeof rawResult === 'number' ? rawResult : (didAdvance ? 1 : 0);
        if (pagesJumped > 0) {
            tableState.currentPageIndex += pagesJumped;
        }
        return didAdvance;
    });
    const result = {
        get currentPageIndex() { return tableState.currentPageIndex; },
        set currentPageIndex(v) { tableState.currentPageIndex = v; },
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
            // Use header cell for scrolling
            const headerCell = resolve(config.headerSelector, rootLocator).nth(idx);
            yield headerCell.scrollIntoViewIfNeeded();
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
            var _a;
            log("Resetting table...");
            yield config.onReset(createStrategyContext());
            if ((_a = config.strategies.pagination) === null || _a === void 0 ? void 0 : _a.goToFirst) {
                log("Auto-navigating to first page...");
                yield config.strategies.pagination.goToFirst(createStrategyContext());
            }
            else if (hasPaginationInConfig) {
                log("No goToFirst strategy configured. Table may not be on page 1.");
            }
            _hasPaginated = false;
            tableState.currentPageIndex = 0;
            tableMapper.clear();
            log("Table reset complete. Calling autoInit to restore state.");
            yield _autoInit();
        }),
        revalidate: () => __awaiter(void 0, void 0, void 0, function* () {
            log("Revalidating table structure...");
            yield tableMapper.remapHeaders();
            log("Table revalidated.");
        }),
        getRow: (filters, options = { exact: false }) => {
            const map = tableMapper.getMapSync();
            if (!map)
                throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.findRows() which auto-initialize.');
            const allRows = resolve(config.rowSelector, rootLocator);
            const matchedRows = filterEngine.applyFilters(allRows, filters, map, options.exact || false, rootLocator.page());
            const rowLocator = matchedRows.first();
            return _makeSmart(rowLocator, map, 0); // fallback index 0
        },
        getRowByIndex: (index) => {
            const map = tableMapper.getMapSync();
            if (!map)
                throw new Error('Table not initialized. Call await table.init() first, or use async methods like table.findRow() or table.findRows() which auto-initialize.');
            const rowLocator = resolve(config.rowSelector, rootLocator).nth(index);
            return _makeSmart(rowLocator, map, index);
        },
        findRow: (filters, options) => __awaiter(void 0, void 0, void 0, function* () {
            return rowFinder.findRow(filters, options);
        }),
        findRows: (filters, options) => __awaiter(void 0, void 0, void 0, function* () {
            return rowFinder.findRows(filters !== null && filters !== void 0 ? filters : {}, options);
        }),
        isInitialized: () => {
            return tableMapper.isInitialized();
        },
        sorting: {
            apply: (columnName, direction) => __awaiter(void 0, void 0, void 0, function* () {
                var _a;
                yield _autoInit();
                if (!config.strategies.sorting)
                    throw new Error('No sorting strategy has been configured.');
                log(`Applying sort for column "${columnName}" (${direction})`);
                const context = Object.assign(Object.assign({}, createStrategyContext()), { getHeaderCell: result.getHeaderCell });
                const maxRetries = 3;
                for (let i = 0; i < maxRetries; i++) {
                    const currentState = yield config.strategies.sorting.getSortState({ columnName, context });
                    if (currentState === direction) {
                        log(`Sort for "${columnName}" is already "${direction}".`);
                        return;
                    }
                    yield config.strategies.sorting.doSort({ columnName, direction, context });
                    if ((_a = config.strategies.loading) === null || _a === void 0 ? void 0 : _a.isTableLoading) {
                        yield config.strategies.loading.isTableLoading(context);
                    }
                    else {
                        yield rootLocator.page().waitForTimeout(200);
                    }
                    yield (0, debugUtils_1.debugDelay)(config, 'default');
                    const newState = yield config.strategies.sorting.getSortState({ columnName, context });
                    if (newState === direction) {
                        log(`Successfully sorted "${columnName}" to "${direction}".`);
                        return;
                    }
                }
                throw new Error(`Failed to sort column "${columnName}" to "${direction}" after ${maxRetries} attempts.`);
            }),
            getState: (columnName) => __awaiter(void 0, void 0, void 0, function* () {
                yield _autoInit();
                if (!config.strategies.sorting)
                    throw new Error('No sorting strategy has been configured.');
                const context = Object.assign(Object.assign({}, createStrategyContext()), { getHeaderCell: result.getHeaderCell });
                return config.strategies.sorting.getSortState({ columnName, context });
            })
        },
        // ─── Shared async row iterator ───────────────────────────────────────────
        [Symbol.asyncIterator]() {
            return __asyncGenerator(this, arguments, function* _a() {
                yield __await(_autoInit());
                const map = tableMapper.getMapSync();
                const effectiveMaxPages = config.maxPages;
                const tracker = new elementTracker_1.ElementTracker('iterator');
                const useBulk = false; // iterator has no options; default goNext
                try {
                    let rowIndex = 0;
                    let pagesScanned = 1;
                    while (true) {
                        const rowLocators = resolve(config.rowSelector, rootLocator);
                        const newIndices = yield __await(tracker.getUnseenIndices(rowLocators));
                        const pageRows = yield __await(rowLocators.all());
                        for (const idx of newIndices) {
                            yield yield __await({ row: _makeSmart(pageRows[idx], map, rowIndex), rowIndex });
                            rowIndex++;
                        }
                        if (pagesScanned >= effectiveMaxPages)
                            break;
                        if (!(yield __await(_advancePage(useBulk))))
                            break;
                        pagesScanned++;
                    }
                }
                finally {
                    yield __await(tracker.cleanup(rootLocator.page()));
                }
            });
        },
        // ─── Row iteration (delegated to engine/tableIteration) ──────────────────
        forEach: (callback_1, ...args_1) => __awaiter(void 0, [callback_1, ...args_1], void 0, function* (callback, options = {}) {
            yield _autoInit();
            yield (0, tableIteration_1.runForEach)({
                getRowLocators: () => resolve(config.rowSelector, rootLocator),
                getMap: () => tableMapper.getMapSync(),
                advancePage: _advancePage,
                makeSmartRow: (loc, map, idx, pageIdx) => _makeSmart(loc, map, idx, pageIdx),
                createSmartRowArray: smartRowArray_1.createSmartRowArray,
                config,
                getPage: () => rootLocator.page(),
            }, callback, options);
        }),
        map: (callback_1, ...args_1) => __awaiter(void 0, [callback_1, ...args_1], void 0, function* (callback, options = {}) {
            yield _autoInit();
            return (0, tableIteration_1.runMap)({
                getRowLocators: () => resolve(config.rowSelector, rootLocator),
                getMap: () => tableMapper.getMapSync(),
                advancePage: _advancePage,
                makeSmartRow: (loc, map, idx, pageIdx) => _makeSmart(loc, map, idx, pageIdx),
                createSmartRowArray: smartRowArray_1.createSmartRowArray,
                config,
                getPage: () => rootLocator.page(),
            }, callback, options);
        }),
        filter: (predicate_1, ...args_1) => __awaiter(void 0, [predicate_1, ...args_1], void 0, function* (predicate, options = {}) {
            yield _autoInit();
            return (0, tableIteration_1.runFilter)({
                getRowLocators: () => resolve(config.rowSelector, rootLocator),
                getMap: () => tableMapper.getMapSync(),
                advancePage: _advancePage,
                makeSmartRow: (loc, map, idx, pageIdx) => _makeSmart(loc, map, idx, pageIdx),
                createSmartRowArray: smartRowArray_1.createSmartRowArray,
                config,
                getPage: () => rootLocator.page(),
            }, predicate, options);
        }),
        generateConfig: () => __awaiter(void 0, void 0, void 0, function* () {
            const html = yield _getCleanHtml(rootLocator);
            const separator = "=".repeat(50);
            const content = `\n${separator} \n🤖 COPY INTO GEMINI / ChatGPT 🤖\n${separator} \nI am using 'playwright-smart-table'.\nTarget Table Locator: ${rootLocator.toString()} \nGenerate config for: \n\`\`\`html\n${html.substring(0, 10000)} ...\n\`\`\`\n${separator}\n`;
            yield _handlePrompt('Smart Table Config', content);
        }),
        generateConfigPrompt: () => __awaiter(void 0, void 0, void 0, function* () {
            console.warn('⚠️ [playwright-smart-table] generateConfigPrompt() is deprecated and will be removed in v7.0.0. Please use generateConfig() instead.');
            return result.generateConfig();
        }),
    };
    createStrategyContext = () => ({
        root: rootLocator,
        config,
        page: rootLocator.page(),
        resolve,
        getHeaderCell: result.getHeaderCell,
        getHeaders: result.getHeaders,
        scrollToColumn: result.scrollToColumn,
    });
    finalTable = result;
    return result;
};
exports.useTable = useTable;
