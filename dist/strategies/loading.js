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
exports.LoadingStrategies = void 0;
/**
 * Strategies for detecting loading states.
 * Return `true` if the item is loading/busy, `false` if it is ready.
 */
exports.LoadingStrategies = {
    /**
     * Strategies for detecting if the entire table is loading.
     */
    Table: {
        /**
         * Checks if a global spinner or loading overlay is visible.
         * @param selector Selector for the loading indicator (e.g. '.loading-spinner')
         */
        hasSpinner: (selector = '.loading-spinner') => (_a) => __awaiter(void 0, [_a], void 0, function* ({ root }) {
            // Check if spinner exists and is visible within the table wrapper or page
            const spinner = root.locator(selector).first();
            try {
                return yield spinner.isVisible();
            }
            catch (_b) {
                return false;
            }
        }),
        /**
         * Custom function to determine table loading state.
         */
        custom: (fn) => fn,
        /**
         * Assume table is never loading (default).
         */
        never: () => __awaiter(void 0, void 0, void 0, function* () { return false; })
    },
    /**
     * Strategies for detecting if a specific row is loading (e.g. Skeleton).
     */
    Row: {
        /**
         * Checks if the row contains a specific class indicating it's a skeleton/loading row.
         * @param className Class name acting as the loading indicator (default: 'skeleton')
         */
        hasClass: (className = 'skeleton') => (row) => __awaiter(void 0, void 0, void 0, function* () {
            const cls = yield row.getAttribute('class');
            return cls ? cls.includes(className) : false;
        }),
        /**
         * Checks if the row's text content matches a "Loading..." string or regex.
         */
        hasText: (text = 'Loading...') => (row) => __awaiter(void 0, void 0, void 0, function* () {
            const content = yield row.innerText();
            if (typeof text === 'string')
                return content.includes(text);
            return text.test(content);
        }),
        /**
         * Checks if the row has any cell with empty/falsy content (if strict).
         * Useful if rows render with empty cells before populating.
         */
        hasEmptyCells: () => (row) => __awaiter(void 0, void 0, void 0, function* () {
            // Logic: Get all cells, check if any are empty.
            // Note: This might be expensive if done for every row check.
            // Simplified: check if InnerText is empty or very short?
            const text = yield row.innerText();
            return !text.trim();
        }),
        /**
         * Assume row is never loading (default).
         */
        never: () => __awaiter(void 0, void 0, void 0, function* () { return false; })
    },
    /**
     * Strategies for detecting if headers are loading/stable.
     */
    Headers: {
        /**
         * Checks if the headers are stable (count and text) for a specified duration.
         * @param duration Duration in ms for headers to remain unchanged to be considered stable (default: 200).
         */
        stable: (duration = 200) => (context) => __awaiter(void 0, void 0, void 0, function* () {
            const { config, resolve, root } = context;
            const getHeaderTexts = () => __awaiter(void 0, void 0, void 0, function* () {
                const headers = yield resolve(config.headerSelector, root).all();
                return Promise.all(headers.map(h => h.innerText()));
            });
            const initial = yield getHeaderTexts();
            // Wait for duration
            yield context.page.waitForTimeout(duration);
            const current = yield getHeaderTexts();
            if (initial.length !== current.length)
                return true; // Count changed, still loading
            for (let i = 0; i < initial.length; i++) {
                if (initial[i] !== current[i])
                    return true; // Content changed, still loading
            }
            return false; // Stable
        }),
        /**
         * Assume headers are never loading (immediate snapshot).
         */
        never: () => __awaiter(void 0, void 0, void 0, function* () { return false; })
    }
};
