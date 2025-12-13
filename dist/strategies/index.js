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
// src/strategies/index.ts
const test_1 = require("@playwright/test");
exports.TableStrategies = {
    /**
     * Strategy: Clicks a "Next" button and waits for the first row of data to change.
     * Best for: Standard pagination (Page 1 > Page 2 > Page 3)
     * * @param nextButtonSelector - Selector for the next button (e.g. 'button.next' or getByRole('button', {name: 'Next'}))
     * @param timeout - How long to wait for the table to refresh (default: 5000ms)
     */
    clickNext: (nextButtonSelector, timeout = 5000) => {
        return (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, config, resolve }) {
            // 1. Find the button using the table's helper
            const nextBtn = resolve(nextButtonSelector, root).first();
            // If button isn't there or disabled, we are at the end
            if (!(yield nextBtn.isVisible()) || !(yield nextBtn.isEnabled())) {
                return false;
            }
            // 2. Snapshot the current state (text of the first row)
            // We use the table's OWN row selector to ensure we are looking at real data
            const firstRow = resolve(config.rowSelector, root).first();
            const oldText = yield firstRow.innerText().catch(() => ""); // Handle empty tables gracefully
            // 3. Click the button
            yield nextBtn.click();
            // 4. Smart Wait: Wait for the first row to have DIFFERENT text
            try {
                yield (0, test_1.expect)(firstRow).not.toHaveText(oldText, { timeout });
                return true; // Success: Data changed
            }
            catch (e) {
                return false; // Failed: Timed out (probably end of data or broken button)
            }
        });
    },
    /**
     * Strategy: Clicks a "Load More" button and waits for the row count to increase.
     * Best for: Lists where "Load More" appends data to the bottom.
     * * @param buttonSelector - Selector for the load more button
     * @param timeout - Wait timeout (default: 5000ms)
     */
    clickLoadMore: (buttonSelector, timeout = 5000) => {
        return (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, config, resolve }) {
            const loadMoreBtn = resolve(buttonSelector, root).first();
            if (!(yield loadMoreBtn.isVisible()) || !(yield loadMoreBtn.isEnabled())) {
                return false;
            }
            // 1. Snapshot: Count current rows
            const rows = resolve(config.rowSelector, root);
            const oldCount = yield rows.count();
            // 2. Click
            yield loadMoreBtn.click();
            // 3. Smart Wait: Wait for row count to be greater than before
            try {
                yield (0, test_1.expect)(() => __awaiter(void 0, void 0, void 0, function* () {
                    const newCount = yield rows.count();
                    (0, test_1.expect)(newCount).toBeGreaterThan(oldCount);
                })).toPass({ timeout });
                return true;
            }
            catch (e) {
                return false;
            }
        });
    },
    /**
     * Strategy: Scrolls to the bottom of the table and waits for more rows to appear.
     * Best for: Infinite Scroll grids (Ag-Grid, Virtual Lists)
     * * @param timeout - Wait timeout (default: 5000ms)
     */
    infiniteScroll: (timeout = 5000) => {
        return (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, config, resolve, page }) {
            const rows = resolve(config.rowSelector, root);
            const oldCount = yield rows.count();
            if (oldCount === 0)
                return false;
            // Aggressive Scroll Logic:
            // We use expect.poll to RETRY the scroll action if the count hasn't increased.
            // This fixes flakiness where the first scroll might be missed by the intersection observer.
            try {
                yield test_1.expect.poll(() => __awaiter(void 0, void 0, void 0, function* () {
                    // 1. Trigger: Scroll the last row into view
                    yield rows.last().scrollIntoViewIfNeeded();
                    // 2. Force: Press "End" to help with stubborn window-scrollers
                    yield page.keyboard.press('End');
                    // 3. Return count for assertion
                    return rows.count();
                }), { timeout }).toBeGreaterThan(oldCount);
                return true;
            }
            catch (e) {
                return false;
            }
        });
    }
};
