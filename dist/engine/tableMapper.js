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
exports.TableMapper = void 0;
const headers_1 = require("../strategies/headers");
const debugUtils_1 = require("../utils/debugUtils");
class TableMapper {
    constructor(rootLocator, config, resolve) {
        this._headerMap = null;
        this.rootLocator = rootLocator;
        this.config = config;
        this.resolve = resolve;
    }
    log(msg) {
        (0, debugUtils_1.logDebug)(this.config, 'verbose', msg);
    }
    getMap(timeout) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (this._headerMap)
                return this._headerMap;
            this.log('Mapping headers...');
            const headerTimeout = timeout !== null && timeout !== void 0 ? timeout : 3000;
            const startTime = Date.now();
            if (this.config.autoScroll) {
                try {
                    yield this.rootLocator.scrollIntoViewIfNeeded({ timeout: 1000 });
                }
                catch (e) { }
            }
            const headerLoc = this.resolve(this.config.headerSelector, this.rootLocator);
            const strategy = this.config.strategies.header || headers_1.HeaderStrategies.visible;
            const context = {
                root: this.rootLocator,
                config: this.config,
                page: this.rootLocator.page(),
                resolve: this.resolve
            };
            let lastError = null;
            while (Date.now() - startTime < headerTimeout) {
                // 1. Wait for visibility
                try {
                    yield headerLoc.first().waitFor({ state: 'visible', timeout: 200 });
                }
                catch (e) {
                    // Continue to check existing/loading state even if not strictly "visible" yet
                }
                // 2. Check Smart Loading State
                if ((_a = this.config.strategies.loading) === null || _a === void 0 ? void 0 : _a.isHeaderLoading) {
                    const isStable = !(yield this.config.strategies.loading.isHeaderLoading(context));
                    if (!isStable) {
                        this.log('Headers are loading/unstable... waiting');
                        yield new Promise(r => setTimeout(r, 100));
                        continue;
                    }
                }
                // 3. Attempt Scan
                try {
                    const rawHeaders = yield strategy(context);
                    const entries = yield this.processHeaders(rawHeaders);
                    // Success
                    this._headerMap = new Map(entries);
                    this.log(`Mapped ${entries.length} columns: ${JSON.stringify(entries.map(e => e[0]))}`);
                    return this._headerMap;
                }
                catch (e) {
                    lastError = e;
                    this.log(`Header mapping failed (retrying): ${e.message}`);
                    yield new Promise(r => setTimeout(r, 100));
                }
            }
            throw lastError || new Error(`Timed out waiting for headers after ${headerTimeout}ms`);
        });
    }
    remapHeaders() {
        return __awaiter(this, void 0, void 0, function* () {
            this._headerMap = null;
            yield this.getMap();
        });
    }
    getMapSync() {
        return this._headerMap;
    }
    isInitialized() {
        return this._headerMap !== null;
    }
    clear() {
        this._headerMap = null;
    }
    processHeaders(rawHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            const seenHeaders = new Set();
            const entries = [];
            for (let i = 0; i < rawHeaders.length; i++) {
                let text = rawHeaders[i].trim() || `__col_${i}`;
                if (this.config.headerTransformer) {
                    text = yield this.config.headerTransformer({
                        text,
                        index: i,
                        locator: this.rootLocator.locator(this.config.headerSelector).nth(i),
                        seenHeaders
                    });
                }
                entries.push([text, i]);
                seenHeaders.add(text);
            }
            // Validation: Check for empty table
            if (entries.length === 0) {
                throw new Error(`Initialization Error: No columns found using selector "${this.config.headerSelector}". Check your selector or ensure the table is visible.`);
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
            return entries;
        });
    }
}
exports.TableMapper = TableMapper;
