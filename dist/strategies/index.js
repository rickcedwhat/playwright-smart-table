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
exports.TableStrategies = void 0;
/**
 * Internal helper to wait for a condition to be met.
 * Replaces the dependency on 'expect(...).toPass()' to ensure compatibility
 * with environments like QA Wolf where 'expect' is not globally available.
 */
const waitForCondition = (predicate, timeout, page // Context page for pauses
) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (yield predicate()) {
            return true;
        }
        // Wait 100ms before next check (Standard Polling)
        yield page.waitForTimeout(100).catch(() => new Promise(r => setTimeout(r, 100)));
    }
    return false;
});
exports.TableStrategies = {
    /**
     * Strategy: Clicks a "Next" button and waits for the first row of data to change.
     */
    clickNext: (nextButtonSelector, timeout = 5000) => {
        return (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, config, resolve, page }) {
            const nextBtn = resolve(nextButtonSelector, root).first();
            // Debug log (can be verbose, maybe useful for debugging only)
            // console.log(`[Strategy: clickNext] Checking button...`);
            // Check if button exists/enabled before clicking.
            // We do NOT wait here because if the button isn't visible/enabled, 
            // we assume we reached the last page.
            if (!(yield nextBtn.isVisible())) {
                console.log(`[Strategy: clickNext] Button not visible. Stopping pagination.`);
                return false;
            }
            if (!(yield nextBtn.isEnabled())) {
                console.log(`[Strategy: clickNext] Button disabled. Stopping pagination.`);
                return false;
            }
            // 1. Snapshot current state
            const firstRow = resolve(config.rowSelector, root).first();
            const oldText = yield firstRow.innerText().catch(() => "");
            // 2. Click
            console.log(`[Strategy: clickNext] Clicking next button...`);
            try {
                yield nextBtn.click({ timeout: 2000 });
            }
            catch (e) {
                console.warn(`[Strategy: clickNext] Click failed (blocked or detached): ${e}`);
                return false;
            }
            // 3. Smart Wait (Polling)
            const success = yield waitForCondition(() => __awaiter(void 0, void 0, void 0, function* () {
                const newText = yield firstRow.innerText().catch(() => "");
                return newText !== oldText;
            }), timeout, page);
            if (!success) {
                console.warn(`[Strategy: clickNext] Warning: Table content did not change after clicking Next.`);
            }
            return success;
        });
    },
    /**
     * Strategy: Clicks a "Load More" button and waits for the row count to increase.
     */
    clickLoadMore: (buttonSelector, timeout = 5000) => {
        return (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, config, resolve, page }) {
            const loadMoreBtn = resolve(buttonSelector, root).first();
            if (!(yield loadMoreBtn.isVisible()) || !(yield loadMoreBtn.isEnabled())) {
                return false;
            }
            // 1. Snapshot count
            const rows = resolve(config.rowSelector, root);
            const oldCount = yield rows.count();
            // 2. Click
            yield loadMoreBtn.click();
            // 3. Smart Wait (Polling)
            return yield waitForCondition(() => __awaiter(void 0, void 0, void 0, function* () {
                const newCount = yield rows.count();
                return newCount > oldCount;
            }), timeout, page);
        });
    },
    /**
     * Strategy: Scrolls to the bottom and waits for more rows to appear.
     */
    infiniteScroll: (timeout = 5000) => {
        return (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, config, resolve, page }) {
            const rows = resolve(config.rowSelector, root);
            const oldCount = yield rows.count();
            if (oldCount === 0)
                return false;
            // 1. Trigger Scroll
            yield rows.last().scrollIntoViewIfNeeded();
            // 2. Smart Wait (Polling)
            return yield waitForCondition(() => __awaiter(void 0, void 0, void 0, function* () {
                const newCount = yield rows.count();
                return newCount > oldCount;
            }), timeout, page);
        });
    }
};
