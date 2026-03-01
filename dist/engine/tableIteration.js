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
exports.runForEach = runForEach;
exports.runMap = runMap;
exports.runFilter = runFilter;
const elementTracker_1 = require("../utils/elementTracker");
/**
 * Shared row-iteration loop used by forEach, map, and filter.
 */
function runForEach(env_1, callback_1) {
    return __awaiter(this, arguments, void 0, function* (env, callback, options = {}) {
        var _a, _b, _c, _d;
        const map = env.getMap();
        const effectiveMaxPages = (_a = options.maxPages) !== null && _a !== void 0 ? _a : env.config.maxPages;
        const dedupeStrategy = (_b = options.dedupe) !== null && _b !== void 0 ? _b : env.config.strategies.dedupe;
        const dedupeKeys = dedupeStrategy ? new Set() : null;
        const parallel = (_c = options.parallel) !== null && _c !== void 0 ? _c : false;
        const useBulk = (_d = options.useBulkPagination) !== null && _d !== void 0 ? _d : false;
        const tracker = new elementTracker_1.ElementTracker('forEach');
        try {
            let rowIndex = 0;
            let stopped = false;
            let pagesScanned = 1;
            const stop = () => { stopped = true; };
            while (!stopped) {
                const rowLocators = env.getRowLocators();
                const newIndices = yield tracker.getUnseenIndices(rowLocators);
                const pageRows = yield rowLocators.all();
                const smartRows = newIndices.map((idx, i) => env.makeSmartRow(pageRows[idx], map, rowIndex + i));
                if (parallel) {
                    yield Promise.all(smartRows.map((row) => __awaiter(this, void 0, void 0, function* () {
                        if (stopped)
                            return;
                        if (dedupeKeys && dedupeStrategy) {
                            const key = yield dedupeStrategy(row);
                            if (dedupeKeys.has(key))
                                return;
                            dedupeKeys.add(key);
                        }
                        yield callback({ row, rowIndex: row.rowIndex, stop });
                    })));
                }
                else {
                    for (const row of smartRows) {
                        if (stopped)
                            break;
                        if (dedupeKeys && dedupeStrategy) {
                            const key = yield dedupeStrategy(row);
                            if (dedupeKeys.has(key))
                                continue;
                            dedupeKeys.add(key);
                        }
                        yield callback({ row, rowIndex: row.rowIndex, stop });
                    }
                }
                rowIndex += smartRows.length;
                if (stopped || pagesScanned >= effectiveMaxPages)
                    break;
                if (!(yield env.advancePage(useBulk)))
                    break;
                pagesScanned++;
            }
        }
        finally {
            yield tracker.cleanup(env.getPage());
        }
    });
}
/**
 * Shared row-iteration loop for map.
 */
function runMap(env_1, callback_1) {
    return __awaiter(this, arguments, void 0, function* (env, callback, options = {}) {
        var _a, _b, _c, _d;
        const map = env.getMap();
        const effectiveMaxPages = (_a = options.maxPages) !== null && _a !== void 0 ? _a : env.config.maxPages;
        const dedupeStrategy = (_b = options.dedupe) !== null && _b !== void 0 ? _b : env.config.strategies.dedupe;
        const dedupeKeys = dedupeStrategy ? new Set() : null;
        const parallel = (_c = options.parallel) !== null && _c !== void 0 ? _c : true;
        const useBulk = (_d = options.useBulkPagination) !== null && _d !== void 0 ? _d : false;
        const tracker = new elementTracker_1.ElementTracker('map');
        const results = [];
        const SKIP = Symbol('skip');
        try {
            let rowIndex = 0;
            let stopped = false;
            let pagesScanned = 1;
            const stop = () => { stopped = true; };
            while (!stopped) {
                const rowLocators = env.getRowLocators();
                const newIndices = yield tracker.getUnseenIndices(rowLocators);
                const pageRows = yield rowLocators.all();
                const smartRows = newIndices.map((idx, i) => env.makeSmartRow(pageRows[idx], map, rowIndex + i));
                if (parallel) {
                    const pageResults = yield Promise.all(smartRows.map((row) => __awaiter(this, void 0, void 0, function* () {
                        if (dedupeKeys && dedupeStrategy) {
                            const key = yield dedupeStrategy(row);
                            if (dedupeKeys.has(key))
                                return SKIP;
                            dedupeKeys.add(key);
                        }
                        return callback({ row, rowIndex: row.rowIndex, stop });
                    })));
                    for (const r of pageResults) {
                        if (r !== SKIP)
                            results.push(r);
                    }
                }
                else {
                    for (const row of smartRows) {
                        if (stopped)
                            break;
                        if (dedupeKeys && dedupeStrategy) {
                            const key = yield dedupeStrategy(row);
                            if (dedupeKeys.has(key))
                                continue;
                            dedupeKeys.add(key);
                        }
                        results.push(yield callback({ row, rowIndex: row.rowIndex, stop }));
                    }
                }
                rowIndex += smartRows.length;
                if (stopped || pagesScanned >= effectiveMaxPages)
                    break;
                if (!(yield env.advancePage(useBulk)))
                    break;
                pagesScanned++;
            }
        }
        finally {
            yield tracker.cleanup(env.getPage());
        }
        return results;
    });
}
/**
 * Shared row-iteration loop for filter.
 */
function runFilter(env_1, predicate_1) {
    return __awaiter(this, arguments, void 0, function* (env, predicate, options = {}) {
        var _a, _b, _c, _d;
        const map = env.getMap();
        const effectiveMaxPages = (_a = options.maxPages) !== null && _a !== void 0 ? _a : env.config.maxPages;
        const dedupeStrategy = (_b = options.dedupe) !== null && _b !== void 0 ? _b : env.config.strategies.dedupe;
        const dedupeKeys = dedupeStrategy ? new Set() : null;
        const parallel = (_c = options.parallel) !== null && _c !== void 0 ? _c : false;
        const useBulk = (_d = options.useBulkPagination) !== null && _d !== void 0 ? _d : false;
        const tracker = new elementTracker_1.ElementTracker('filter');
        const matched = [];
        try {
            let rowIndex = 0;
            let stopped = false;
            let pagesScanned = 1;
            const stop = () => { stopped = true; };
            while (!stopped) {
                const rowLocators = env.getRowLocators();
                const newIndices = yield tracker.getUnseenIndices(rowLocators);
                const pageRows = yield rowLocators.all();
                const smartRows = newIndices.map((idx, i) => env.makeSmartRow(pageRows[idx], map, rowIndex + i, pagesScanned - 1));
                if (parallel) {
                    const flags = yield Promise.all(smartRows.map((row) => __awaiter(this, void 0, void 0, function* () {
                        if (dedupeKeys && dedupeStrategy) {
                            const key = yield dedupeStrategy(row);
                            if (dedupeKeys.has(key))
                                return false;
                            dedupeKeys.add(key);
                        }
                        return predicate({ row, rowIndex: row.rowIndex, stop });
                    })));
                    smartRows.forEach((row, i) => { if (flags[i])
                        matched.push(row); });
                }
                else {
                    for (const row of smartRows) {
                        if (stopped)
                            break;
                        if (dedupeKeys && dedupeStrategy) {
                            const key = yield dedupeStrategy(row);
                            if (dedupeKeys.has(key))
                                continue;
                            dedupeKeys.add(key);
                        }
                        if (yield predicate({ row, rowIndex: row.rowIndex, stop })) {
                            matched.push(row);
                        }
                    }
                }
                rowIndex += smartRows.length;
                if (stopped || pagesScanned >= effectiveMaxPages)
                    break;
                if (!(yield env.advancePage(useBulk)))
                    break;
                pagesScanned++;
            }
        }
        finally {
            yield tracker.cleanup(env.getPage());
        }
        return env.createSmartRowArray(matched);
    });
}
