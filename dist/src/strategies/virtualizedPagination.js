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
exports.VirtualizedPaginationStrategies = exports.virtualizedInfiniteScroll = void 0;
/**
 * Strategies for handling virtualized pagination where:
 * 1. The total row count might not change (DOM recycling).
 * 2. We need to check for *new content* appearing to confirm pagination success.
 */
const virtualizedInfiniteScroll = (options = {}) => {
    return (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, config, page, resolve }) {
        var _b, _c, _d;
        const scrollTargetLocator = options.scrollTarget
            ? (typeof options.scrollTarget === 'string' ? root.locator(options.scrollTarget) : resolve(options.scrollTarget, root))
            : root;
        // Resolve the rows locator
        const rows = resolve(config.rowSelector, root);
        // Helper to get a "fingerprint" of the current visible content
        const getFingerprint = () => __awaiter(void 0, void 0, void 0, function* () {
            // We grab all inner texts of the rows as a crude but effective hash
            // Virtualization replaces row content, so this ensures we detect changes
            const allText = yield rows.allInnerTexts();
            return allText.join('|');
        });
        const beforeFingerprint = yield getFingerprint();
        const startScrollTop = yield scrollTargetLocator.evaluate((el) => el.scrollTop).catch(() => 0);
        // --- Perform Scroll ---
        const amount = (_b = options.scrollAmount) !== null && _b !== void 0 ? _b : 500;
        const box = yield scrollTargetLocator.boundingBox();
        if (options.useJsScroll || !box) {
            // Fast path: JS Scroll or fallback if no bounding box
            yield scrollTargetLocator.evaluate((el, y) => {
                el.scrollTop += y;
            }, amount);
        }
        else {
            // Realistic path: Mouse Wheel
            // Move to center of the scroll container
            yield page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            yield page.mouse.wheel(0, amount);
        }
        // Wait for the virtual list to settle/render new items
        yield page.waitForTimeout((_c = options.stabilityTimeout) !== null && _c !== void 0 ? _c : 500);
        // --- Verification ---
        const endScrollTop = yield scrollTargetLocator.evaluate((el) => el.scrollTop).catch(() => 0);
        // If we didn't physically scroll (hit bottom or element not scrollable), we're done.
        // Note: Some virtual lists allow overscroll, so this check isn't 100% foolproof but helpful.
        if (endScrollTop <= startScrollTop) {
            // Double check content just in case
            const afterCheck = yield getFingerprint();
            const changed = afterCheck !== beforeFingerprint;
            if (changed)
                return true;
            return false;
        }
        // Retry loop to allow for async loading/rendering of new rows
        let retries = (_d = options.retries) !== null && _d !== void 0 ? _d : 3;
        while (retries > 0) {
            const afterFingerprint = yield getFingerprint();
            if (afterFingerprint !== beforeFingerprint) {
                return true; // Content changed!
            }
            yield page.waitForTimeout(200);
            retries--;
        }
        return false; // No change in content detected
    });
};
exports.virtualizedInfiniteScroll = virtualizedInfiniteScroll;
exports.VirtualizedPaginationStrategies = {
    virtualInfiniteScroll: exports.virtualizedInfiniteScroll
};
