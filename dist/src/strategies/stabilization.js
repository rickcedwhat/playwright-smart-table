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
exports.StabilizationStrategies = void 0;
exports.StabilizationStrategies = {
    /**
     * Waits for the visible text of the table rows to change.
     */
    contentChanged: (options = {}) => {
        return (_a, action_1) => __awaiter(void 0, [_a, action_1], void 0, function* ({ root, config, resolve, page }, action) {
            var _b, _c;
            const rows = resolve(config.rowSelector, root);
            const timeout = (_b = options.timeout) !== null && _b !== void 0 ? _b : 5000;
            const scope = (_c = options.scope) !== null && _c !== void 0 ? _c : 'all';
            // Helper to get fingerprint
            const getFingerprint = () => __awaiter(void 0, void 0, void 0, function* () {
                if (scope === 'first') {
                    return yield rows.first().innerText().catch(() => '');
                }
                const allText = yield rows.allInnerTexts();
                return allText.join('|');
            });
            // 1. Capture Before
            const beforeFingerprint = yield getFingerprint();
            // 2. Perform Action
            yield action();
            // 3. Wait for Change
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                const afterFingerprint = yield getFingerprint();
                if (afterFingerprint !== beforeFingerprint) {
                    return true;
                }
                yield page.waitForTimeout(100);
            }
            return false;
        });
    },
    /**
     * Waits for the total number of rows to strictly increase.
     */
    rowCountIncreased: (options = {}) => {
        return (_a, action_1) => __awaiter(void 0, [_a, action_1], void 0, function* ({ root, config, resolve, page }, action) {
            var _b;
            const rows = resolve(config.rowSelector, root);
            const timeout = (_b = options.timeout) !== null && _b !== void 0 ? _b : 5000;
            const beforeCount = yield rows.count();
            yield action();
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                const afterCount = yield rows.count();
                if (afterCount > beforeCount) {
                    return true;
                }
                yield page.waitForTimeout(100);
            }
            return false;
        });
    },
    /**
     * Waits for a specific network condition or spinner to disappear.
     * Useful for tables that have explicit loading states but might not change content immediately.
     */
    networkIdle: (options = {}) => {
        return (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, page, resolve }) {
            var _b;
            const timeout = (_b = options.timeout) !== null && _b !== void 0 ? _b : 5000;
            if (options.spinnerSelector) {
                const spinner = resolve(options.spinnerSelector, root);
                try {
                    yield spinner.waitFor({ state: 'detached', timeout });
                    return true;
                }
                catch (_c) {
                    return false;
                }
            }
            // Fallback to simple wait if no selector
            yield page.waitForTimeout(500);
            return true;
        });
    }
};
