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
exports.PaginationStrategies = void 0;
const stabilization_1 = require("./stabilization");
exports.PaginationStrategies = {
    /**
     * Strategy: Clicks a "Next" button and waits for stabilization.
     * @param nextButtonSelector Selector for the next page button.
     * @param options.stabilization Strategy to determine when the page has updated.
     *        Defaults to `contentChanged({ scope: 'first' })`.
     * @param options.timeout Timeout for the click action.
     */
    clickNext: (nextButtonSelector, options = {}) => {
        return (context) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const { root, resolve, page } = context;
            const nextBtn = resolve(nextButtonSelector, root).first();
            if (!(yield nextBtn.isVisible()) || !(yield nextBtn.isEnabled())) {
                return false;
            }
            // Default stabilization: Wait for first row content to change
            const stabilization = (_a = options.stabilization) !== null && _a !== void 0 ? _a : stabilization_1.StabilizationStrategies.contentChanged({ scope: 'first', timeout: options.timeout });
            // Stabilization: Wrap action
            const success = yield stabilization(context, () => __awaiter(void 0, void 0, void 0, function* () {
                yield nextBtn.click({ timeout: 2000 }).catch(() => { });
            }));
            return success;
        });
    },
    /**
     * Strategy: Infinite Scroll (generic).
     * Supports both simple "Scroll to Bottom" and "Virtualized Scroll".
     *
     * @param options.action 'scroll' (mouse wheel) or 'js-scroll' (direct scrollTop).
     * @param options.scrollTarget Selector for the scroll container (defaults to table root).
     * @param options.scrollAmount Amount to scroll in pixels (default 500).
     * @param options.stabilization Strategy to determine if new content loaded.
     *        Defaults to `rowCountIncreased` (simple append).
     *        Use `contentChanged` for virtualization.
     */
    infiniteScroll: (options = {}) => {
        return (context) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const { root, resolve, page } = context;
            const scrollTarget = options.scrollTarget
                ? resolve(options.scrollTarget, root)
                : root;
            // Default stabilization: Wait for row count to increase (Append mode)
            const stabilization = (_a = options.stabilization) !== null && _a !== void 0 ? _a : stabilization_1.StabilizationStrategies.rowCountIncreased({ timeout: options.timeout });
            const amount = (_b = options.scrollAmount) !== null && _b !== void 0 ? _b : 500;
            const doScroll = () => __awaiter(void 0, void 0, void 0, function* () {
                const box = yield scrollTarget.boundingBox();
                // Action: Scroll
                if (options.action === 'js-scroll' || !box) {
                    yield scrollTarget.evaluate((el, y) => {
                        el.scrollTop += y;
                    }, amount);
                }
                else {
                    // Mouse Wheel
                    yield page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                    yield page.mouse.wheel(0, amount);
                }
            });
            // Stabilization: Wait
            const success = yield stabilization(context, doScroll);
            return success;
        });
    }
};
