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
exports.TableStrategies = exports.PaginationStrategies = void 0;
const utils_1 = require("../utils");
exports.PaginationStrategies = {
    /**
     * Strategy: Clicks a "Next" button and waits for the first row of data to change.
     */
    clickNext: (nextButtonSelector, timeout = 5000) => {
        return (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, config, resolve, page }) {
            const nextBtn = resolve(nextButtonSelector, root).first();
            if (!(yield nextBtn.isVisible()) || !(yield nextBtn.isEnabled())) {
                return false;
            }
            const firstRow = resolve(config.rowSelector, root).first();
            const oldText = yield firstRow.innerText().catch(() => "");
            yield nextBtn.click({ timeout: 2000 }).catch(() => { });
            const success = yield (0, utils_1.waitForCondition)(() => __awaiter(void 0, void 0, void 0, function* () {
                const newText = yield firstRow.innerText().catch(() => "");
                return newText !== oldText;
            }), timeout, page);
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
            const rows = resolve(config.rowSelector, root);
            const oldCount = yield rows.count();
            yield loadMoreBtn.click();
            return yield (0, utils_1.waitForCondition)(() => __awaiter(void 0, void 0, void 0, function* () {
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
            yield rows.last().scrollIntoViewIfNeeded();
            return yield (0, utils_1.waitForCondition)(() => __awaiter(void 0, void 0, void 0, function* () {
                const newCount = yield rows.count();
                return newCount > oldCount;
            }), timeout, page);
        });
    }
};
/**
 * @deprecated Use `PaginationStrategies` instead. This alias will be removed in a future major version.
 */
exports.TableStrategies = exports.PaginationStrategies;
