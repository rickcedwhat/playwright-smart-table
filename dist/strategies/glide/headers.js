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
exports.scrollRightHeader = void 0;
/**
 * Scans for headers by finding a scrollable container and setting scrollLeft.
 */
const scrollRightHeader = (context, options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { resolve, config, root, page } = context;
    const limit = (_a = options === null || options === void 0 ? void 0 : options.limit) !== null && _a !== void 0 ? _a : 20;
    const scrollAmount = (_b = options === null || options === void 0 ? void 0 : options.scrollAmount) !== null && _b !== void 0 ? _b : 300;
    const collectedHeaders = new Set();
    const getVisible = () => __awaiter(void 0, void 0, void 0, function* () {
        const headerLoc = resolve(config.headerSelector, root);
        const texts = yield headerLoc.allInnerTexts();
        return texts.map(t => t.trim());
    });
    // Initial capture
    let currentHeaders = yield getVisible();
    currentHeaders.forEach(h => collectedHeaders.add(h));
    // Find scroller using JS for better iframe/shadow support
    const scrollerHandle = yield root.evaluateHandle((el, selector) => {
        if (selector && el.matches(selector))
            return el;
        const effectiveSelector = selector || '.dvn-scroller';
        const ancestor = el.closest(effectiveSelector);
        if (ancestor)
            return ancestor;
        return document.querySelector(effectiveSelector);
    }, options === null || options === void 0 ? void 0 : options.selector);
    const isScrollerFound = yield scrollerHandle.evaluate(el => !!el);
    if (isScrollerFound) {
        yield scrollerHandle.evaluate(el => el.scrollLeft = 0);
        yield page.waitForTimeout(200);
        for (let i = 0; i < limit; i++) {
            const sizeBefore = collectedHeaders.size;
            yield scrollerHandle.evaluate((el, amount) => el.scrollLeft += amount, scrollAmount);
            yield page.waitForTimeout(300);
            const newHeaders = yield getVisible();
            newHeaders.forEach(h => collectedHeaders.add(h));
            if (collectedHeaders.size === sizeBefore) {
                yield scrollerHandle.evaluate((el, amount) => el.scrollLeft += amount, scrollAmount);
                yield page.waitForTimeout(300);
                const retryHeaders = yield getVisible();
                retryHeaders.forEach(h => collectedHeaders.add(h));
                if (collectedHeaders.size === sizeBefore)
                    break;
            }
        }
    }
    else {
        console.warn("HeaderStrategies.scrollRight: Could not find scroller. Returning visible headers.");
    }
    // Scroll back to start
    yield scrollerHandle.evaluate(el => el.scrollLeft = 0);
    yield page.waitForTimeout(200);
    return Array.from(collectedHeaders);
});
exports.scrollRightHeader = scrollRightHeader;
