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
    click: (selectors, options = {}) => {
        var _a, _b, _c;
        const defaultStabilize = (_a = options.stabilization) !== null && _a !== void 0 ? _a : stabilization_1.StabilizationStrategies.contentChanged({ scope: 'first', timeout: options.timeout });
        const createClicker = (selector, returnVal = true) => {
            if (!selector)
                return undefined;
            return (context) => __awaiter(void 0, void 0, void 0, function* () {
                const { root, resolve } = context;
                const btn = resolve(selector, root).first();
                if (!btn || !(yield btn.isVisible()) || !(yield btn.isEnabled())) {
                    return false;
                }
                return yield defaultStabilize(context, () => __awaiter(void 0, void 0, void 0, function* () {
                    yield btn.click({ timeout: 2000 }).catch(() => { });
                })).then(stabilized => stabilized ? returnVal : false);
            });
        };
        const nextBulk = (_b = options.nextBulkPages) !== null && _b !== void 0 ? _b : 10;
        const prevBulk = (_c = options.previousBulkPages) !== null && _c !== void 0 ? _c : 10;
        return {
            goNext: createClicker(selectors.next),
            goPrevious: createClicker(selectors.previous),
            goNextBulk: createClicker(selectors.nextBulk, nextBulk),
            goPreviousBulk: createClicker(selectors.previousBulk, prevBulk),
            goToFirst: createClicker(selectors.first),
            nextBulkPages: nextBulk,
            previousBulkPages: prevBulk,
        };
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
        var _a, _b;
        // Default stabilization: Wait for row count to increase (Append mode)
        const stabilization = (_a = options.stabilization) !== null && _a !== void 0 ? _a : stabilization_1.StabilizationStrategies.rowCountIncreased({ timeout: options.timeout });
        const amount = (_b = options.scrollAmount) !== null && _b !== void 0 ? _b : 500;
        const createScroller = (directionMultiplier) => {
            return (context) => __awaiter(void 0, void 0, void 0, function* () {
                const { root, resolve, page } = context;
                const scrollTarget = options.scrollTarget
                    ? resolve(options.scrollTarget, root)
                    : root;
                const doScroll = () => __awaiter(void 0, void 0, void 0, function* () {
                    const box = yield scrollTarget.boundingBox();
                    const scrollValue = amount * directionMultiplier;
                    // Action: Scroll
                    if (options.action === 'js-scroll' || !box) {
                        yield scrollTarget.evaluate((el, y) => {
                            el.scrollTop += y;
                        }, scrollValue);
                    }
                    else {
                        // Mouse Wheel
                        yield page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                        yield page.mouse.wheel(0, scrollValue);
                    }
                });
                // Stabilization: Wait
                return yield stabilization(context, doScroll);
            });
        };
        const createGoToFirst = () => {
            return (context) => __awaiter(void 0, void 0, void 0, function* () {
                const { root, resolve } = context;
                const scrollTarget = options.scrollTarget
                    ? resolve(options.scrollTarget, root)
                    : root;
                const doScroll = () => __awaiter(void 0, void 0, void 0, function* () {
                    yield scrollTarget.evaluate((el) => {
                        el.scrollTop = 0;
                        el.scrollLeft = 0;
                    });
                });
                // Stabilization: Wait for content to reset
                return yield stabilization(context, doScroll);
            });
        };
        return {
            goNext: createScroller(1),
            goPrevious: createScroller(-1),
            goToFirst: createGoToFirst()
        };
    }
};
