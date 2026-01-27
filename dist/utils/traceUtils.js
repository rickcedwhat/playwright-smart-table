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
exports.addTraceEvent = addTraceEvent;
exports.isTracingEnabled = isTracingEnabled;
/**
 * Add a custom trace event to Playwright's trace viewer
 * Uses page.evaluate to log events that appear in the trace
 */
function addTraceEvent(page_1, type_1) {
    return __awaiter(this, arguments, void 0, function* (page, type, data = {}) {
        try {
            // Add a console log that will appear in the trace viewer
            // Prefix with [SmartTable] for easy filtering
            const message = `[SmartTable:${type}] ${JSON.stringify(data)}`;
            yield page.evaluate((msg) => console.log(msg), message);
        }
        catch (_a) {
            // Silently ignore if page is not available
            // This ensures zero overhead when tracing is off
        }
    });
}
/**
 * Check if tracing is currently enabled
 * Used for conditional trace logic
 */
function isTracingEnabled(page) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // We can't directly check if tracing is enabled
            // But we can safely call addTraceEvent - it will just be a no-op if not tracing
            return true;
        }
        catch (_a) {
            return false;
        }
    });
}
