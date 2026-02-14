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
    findRows(filters, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const map = yield this.tableMapper.getMap();
            const allRows = [];
            const effectiveMaxPages = (_b = (_a = options === null || options === void 0 ? void 0 : options.maxPages) !== null && _a !== void 0 ? _a : this.config.maxPages) !== null && _b !== void 0 ? _b : Infinity;
            let pageCount = 0;
            const collectMatches = () => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                let rowLocators = this.resolve(this.config.rowSelector, this.rootLocator);
                rowLocators = this.filterEngine.applyFilters(rowLocators, filters, map, (_a = options === null || options === void 0 ? void 0 : options.exact) !== null && _a !== void 0 ? _a : false, this.rootLocator.page());
                const currentRows = yield rowLocators.all();
                const isRowLoading = (_b = this.config.strategies.loading) === null || _b === void 0 ? void 0 : _b.isRowLoading;
                for (let i = 0; i < currentRows.length; i++) {
                    const smartRow = this.makeSmartRow(currentRows[i], map, i);
                    if (isRowLoading && (yield isRowLoading(smartRow)))
                        continue;
                    allRows.push(smartRow);
                }
            });
            // Scan first page
            yield collectMatches();
            // Pagination Loop
            while (pageCount < effectiveMaxPages && this.config.strategies.pagination) {
                // Check if pagination needed? findRows assumes we want ALL matches across maxPages.
                // If explicit maxPages is set, we paginate. If global maxPages is 1 (default), we stop.
                // Wait, loop condition `pageCount < effectiveMaxPages`. If maxPages=1, 0 < 1 is true.
                // We paginate AFTER first scan.
                // If maxPages=1, we should NOT paginate.
                if (effectiveMaxPages <= 1)
                    break;
                const context = {
                    root: this.rootLocator,
                    config: this.config,
                    resolve: this.resolve,
                    page: this.rootLocator.page()
                };
                const paginationResult = yield this.config.strategies.pagination(context);
                const didPaginate = (0, validation_1.validatePaginationResult)(paginationResult, 'Pagination Strategy');
                if (!didPaginate)
                    break;
                pageCount++;
                yield collectMatches();
            }
            if (options === null || options === void 0 ? void 0 : options.asJSON) {
                return Promise.all(allRows.map(r => r.toJSON()));
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
