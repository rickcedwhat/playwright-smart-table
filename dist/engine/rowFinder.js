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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RowFinder = void 0;
const debugUtils_1 = require("../utils/debugUtils");
const smartRowArray_1 = require("../utils/smartRowArray");
const validation_1 = require("../strategies/validation");
class RowFinder {
    constructor(rootLocator, config, resolve, filterEngine, tableMapper, makeSmartRow) {
        this.rootLocator = rootLocator;
        this.config = config;
        this.filterEngine = filterEngine;
        this.tableMapper = tableMapper;
        this.makeSmartRow = makeSmartRow;
        this.resolve = resolve;
    }
    log(msg) {
        (0, debugUtils_1.logDebug)(this.config, 'verbose', msg);
    }
    findRow(filters_1) {
        return __awaiter(this, arguments, void 0, function* (filters, options = {}) {
            (0, debugUtils_1.logDebug)(this.config, 'info', 'Searching for row', filters);
            yield this.tableMapper.getMap();
            const rowLocator = yield this.findRowLocator(filters, options);
            if (rowLocator) {
                (0, debugUtils_1.logDebug)(this.config, 'info', 'Row found');
                yield (0, debugUtils_1.debugDelay)(this.config, 'findRow');
                return this.makeSmartRow(rowLocator, yield this.tableMapper.getMap(), 0);
            }
            (0, debugUtils_1.logDebug)(this.config, 'error', 'Row not found', filters);
            yield (0, debugUtils_1.debugDelay)(this.config, 'findRow');
            const sentinel = this.resolve(this.config.rowSelector, this.rootLocator)
                .filter({ hasText: "___SENTINEL_ROW_NOT_FOUND___" + Date.now() });
            return this.makeSmartRow(sentinel, yield this.tableMapper.getMap(), 0);
        });
    }
    findRows(filtersOrOptions, 
    // Deprecated: verify legacy usage pattern support
    legacyOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            // Detect argument pattern:
            // Pattern A: findRows({ Name: 'Alice' }, { maxPages: 5 })
            // Pattern B: findRows({ maxPages: 5 })  <-- No filters, just options
            // Pattern C: findRows({ Name: 'Alice' }) <-- Only filters
            var _a, _b;
            let filters = {};
            let options = {};
            if (legacyOptions) {
                // Pattern A
                filters = filtersOrOptions;
                options = legacyOptions;
            }
            else {
                // Pattern B or C
                // We need to separate unknown keys (filters) from known options (exact, maxPages)
                // However, filtersOrOptions can be null/undefined
                if (filtersOrOptions) {
                    const _c = filtersOrOptions, { exact, maxPages } = _c, rest = __rest(_c, ["exact", "maxPages"]);
                    options = { exact, maxPages };
                    filters = rest;
                }
            }
            const map = yield this.tableMapper.getMap();
            const allRows = [];
            const effectiveMaxPages = (_b = (_a = options.maxPages) !== null && _a !== void 0 ? _a : this.config.maxPages) !== null && _b !== void 0 ? _b : Infinity;
            let pageCount = 0;
            const collectMatches = () => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                // ... logic ...
                let rowLocators = this.resolve(this.config.rowSelector, this.rootLocator);
                // Only apply filters if we have them
                if (Object.keys(filters).length > 0) {
                    rowLocators = this.filterEngine.applyFilters(rowLocators, filters, map, (_a = options.exact) !== null && _a !== void 0 ? _a : false, this.rootLocator.page());
                }
                const currentRows = yield rowLocators.all();
                const isRowLoading = (_b = this.config.strategies.loading) === null || _b === void 0 ? void 0 : _b.isRowLoading;
                for (let i = 0; i < currentRows.length; i++) {
                    const smartRow = this.makeSmartRow(currentRows[i], map, allRows.length + i);
                    if (isRowLoading && (yield isRowLoading(smartRow)))
                        continue;
                    allRows.push(smartRow);
                }
            });
            // Scan first page
            yield collectMatches();
            // Pagination Loop - Corrected logic
            // We always scan at least 1 page.
            // If maxPages > 1, and we have a pagination strategy, we try to go next.
            while (pageCount < effectiveMaxPages - 1 && this.config.strategies.pagination) {
                const context = {
                    root: this.rootLocator,
                    config: this.config,
                    resolve: this.resolve,
                    page: this.rootLocator.page()
                };
                // Check if we should stop? (e.g. if we found enough rows? No, findRows finds ALL)
                const paginationResult = yield this.config.strategies.pagination(context);
                const didPaginate = yield (0, validation_1.validatePaginationResult)(paginationResult, 'Pagination Strategy');
                if (!didPaginate)
                    break;
                pageCount++;
                // Wait for reload logic if needed? Usually pagination handles it.
                yield collectMatches();
            }
            return (0, smartRowArray_1.createSmartRowArray)(allRows);
        });
    }
    findRowLocator(filters_1) {
        return __awaiter(this, arguments, void 0, function* (filters, options = {}) {
            var _a, _b;
            const map = yield this.tableMapper.getMap();
            const effectiveMaxPages = (_a = options.maxPages) !== null && _a !== void 0 ? _a : this.config.maxPages;
            let currentPage = 1;
            this.log(`Looking for row: ${JSON.stringify(filters)} (MaxPages: ${effectiveMaxPages})`);
            while (true) {
                // Check Loading
                if ((_b = this.config.strategies.loading) === null || _b === void 0 ? void 0 : _b.isTableLoading) {
                    const isLoading = yield this.config.strategies.loading.isTableLoading({
                        root: this.rootLocator,
                        config: this.config,
                        page: this.rootLocator.page(),
                        resolve: this.resolve
                    });
                    if (isLoading) {
                        this.log('Table is loading... waiting');
                        yield this.rootLocator.page().waitForTimeout(200);
                        continue;
                    }
                }
                const allRows = this.resolve(this.config.rowSelector, this.rootLocator);
                const matchedRows = this.filterEngine.applyFilters(allRows, filters, map, options.exact || false, this.rootLocator.page());
                const count = yield matchedRows.count();
                this.log(`Page ${currentPage}: Found ${count} matches.`);
                if (count > 1) {
                    const sampleData = [];
                    try {
                        const firstFewRows = yield matchedRows.all();
                        const sampleCount = Math.min(firstFewRows.length, 3);
                        for (let i = 0; i < sampleCount; i++) {
                            const rowData = yield this.makeSmartRow(firstFewRows[i], map, 0).toJSON();
                            sampleData.push(JSON.stringify(rowData));
                        }
                    }
                    catch (e) { }
                    const sampleMsg = sampleData.length > 0 ? `\nSample matching rows:\n${sampleData.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}` : '';
                    throw new Error(`Ambiguous Row: Found ${count} rows matching ${JSON.stringify(filters)} on page ${currentPage}. ` +
                        `Expected exactly one match. Try adding more filters to make your query unique.${sampleMsg}`);
                }
                if (count === 1)
                    return matchedRows.first();
                if (currentPage < effectiveMaxPages) {
                    this.log(`Page ${currentPage}: Not found. Attempting pagination...`);
                    const context = {
                        root: this.rootLocator,
                        config: this.config,
                        resolve: this.resolve,
                        page: this.rootLocator.page()
                    };
                    const paginationResult = yield this.config.strategies.pagination(context);
                    const didLoadMore = (0, validation_1.validatePaginationResult)(paginationResult, 'Pagination Strategy');
                    if (didLoadMore) {
                        currentPage++;
                        continue;
                    }
                    else {
                        this.log(`Page ${currentPage}: Pagination failed (end of data).`);
                    }
                }
                return null;
            }
        });
    }
}
exports.RowFinder = RowFinder;
