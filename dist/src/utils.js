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
exports.waitForCondition = void 0;
/**
 * Internal helper to wait for a condition to be met.
 * Replaces the dependency on 'expect(...).toPass()' to ensure compatibility
 * with environments where 'expect' is not globally available.
 */
const waitForCondition = (predicate, timeout, page) => __awaiter(void 0, void 0, void 0, function* () {
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
exports.waitForCondition = waitForCondition;
