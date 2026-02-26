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
exports.ElementTracker = void 0;
class ElementTracker {
    constructor(prefix = 'tracker') {
        this.id = `__smartTable_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    /**
     * Finds the indices of newly seen elements in the browser, storing their text signature
     * in a WeakMap. This gracefully handles both append-only DOMs (by identity) and
     * virtualized DOMs (by text signature if nodes are recycled).
     */
    getUnseenIndices(locators) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield locators.evaluateAll((elements, trackerId) => {
                const win = window;
                if (!win[trackerId]) {
                    win[trackerId] = new WeakMap();
                }
                const seenMap = win[trackerId];
                const newIndices = [];
                elements.forEach((el, index) => {
                    // Determine a lightweight signature for the row (textContent strips HTML, fast)
                    const signature = el.textContent || '';
                    // If it's a new element, OR a recycled element with new data
                    if (seenMap.get(el) !== signature) {
                        seenMap.set(el, signature);
                        newIndices.push(index);
                    }
                });
                return newIndices;
            }, this.id);
        });
    }
    /**
     * Cleans up the tracking map from the browser window object.
     */
    cleanup(page) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield page.evaluate((trackerId) => {
                    delete window[trackerId];
                }, this.id);
            }
            catch (e) {
                // Ignore context destroyed errors during cleanup
            }
        });
    }
}
exports.ElementTracker = ElementTracker;
