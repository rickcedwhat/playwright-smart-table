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
exports.HeaderStrategies = void 0;
exports.HeaderStrategies = {
    /**
     * Default strategy: Returns only the headers currently visible in the DOM.
     * This is fast but won't find virtualized columns off-screen.
     */
    visible: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, resolve, root }) {
        const headerLoc = resolve(config.headerSelector, root);
        try {
            // Wait for at least one header to be visible
            yield headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
        }
        catch (e) {
            // Ignore hydration/timeout issues, return what we have
        }
        const texts = yield headerLoc.allInnerTexts();
        return texts.map(t => t.trim());
    }),
    /**
     * Scans for headers by finding a scrollable container and setting scrollLeft.
     */
    scrollRight: (context, options) => __awaiter(void 0, void 0, void 0, function* () {
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
    }),
    /**
     * Strategy that clicks into the table to establish focus and then uses the Right Arrow key
     * to navigate cell-by-cell, collecting headers found along the way.
     */
    keyboard: (context, options) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const { resolve, config, root, page } = context;
        const limit = (_a = options === null || options === void 0 ? void 0 : options.limit) !== null && _a !== void 0 ? _a : 100;
        const maxSilentClicks = (_b = options === null || options === void 0 ? void 0 : options.maxSilentClicks) !== null && _b !== void 0 ? _b : 10;
        const collectedHeaders = new Set();
        const getVisible = () => __awaiter(void 0, void 0, void 0, function* () {
            const headerLoc = resolve(config.headerSelector, root);
            const texts = yield headerLoc.allInnerTexts();
            return texts.map(t => t.trim());
        });
        // 1. Initial capture
        let currentHeaders = yield getVisible();
        currentHeaders.forEach(h => collectedHeaders.add(h));
        // 2. Click to focus
        // Try to find the canvas sibling specifically for Glide, otherwise click root
        const canvas = root.locator('xpath=ancestor::div').locator('canvas').first();
        if ((yield canvas.count()) > 0) {
            // Click lower in the canvas to hit a data cell instead of header
            // Adjusted to y=60 to target Row 1
            yield canvas.click({ position: { x: 50, y: 60 }, force: true }).catch(() => { });
        }
        else {
            yield root.click({ position: { x: 10, y: 10 }, force: true }).catch(() => { });
        }
        // Reset to home
        yield page.keyboard.press('Control+Home');
        yield page.keyboard.press('Home');
        // Wait for potential scroll/focus reset
        yield page.evaluate(() => new Promise(requestAnimationFrame));
        currentHeaders = yield getVisible();
        currentHeaders.forEach(h => collectedHeaders.add(h));
        // 3. Navigate right loop
        let silentCounter = 0;
        for (let i = 0; i < limit; i++) {
            const sizeBefore = collectedHeaders.size;
            yield page.keyboard.press('ArrowRight');
            // Small breathing room for key press to register
            yield page.evaluate(() => new Promise(requestAnimationFrame));
            const newHeaders = yield getVisible();
            newHeaders.forEach(h => collectedHeaders.add(h));
            if (collectedHeaders.size === sizeBefore) {
                silentCounter++;
            }
            else {
                silentCounter = 0;
            }
            if (silentCounter >= maxSilentClicks) {
                break;
            }
        }
        return Array.from(collectedHeaders);
    }),
};
