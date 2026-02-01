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
exports.getDebugDelay = getDebugDelay;
exports.debugDelay = debugDelay;
exports.logDebug = logDebug;
exports.warnIfDebugInCI = warnIfDebugInCI;
/**
 * Get delay for specific action type
 */
function getDebugDelay(config, actionType) {
    var _a, _b, _c;
    if (!((_a = config.debug) === null || _a === void 0 ? void 0 : _a.slow))
        return 0;
    if (typeof config.debug.slow === 'number') {
        return config.debug.slow;
    }
    return (_c = (_b = config.debug.slow[actionType]) !== null && _b !== void 0 ? _b : config.debug.slow.default) !== null && _c !== void 0 ? _c : 0;
}
/**
 * Add debug delay for specific action type
 */
function debugDelay(config, actionType) {
    return __awaiter(this, void 0, void 0, function* () {
        const delay = getDebugDelay(config, actionType);
        if (delay > 0) {
            yield new Promise(resolve => setTimeout(resolve, delay));
        }
    });
}
/**
 * Log debug message based on log level
 */
function logDebug(config, level, message, data) {
    var _a, _b;
    const logLevel = (_b = (_a = config.debug) === null || _a === void 0 ? void 0 : _a.logLevel) !== null && _b !== void 0 ? _b : 'none';
    const levels = { none: 0, error: 1, info: 2, verbose: 3 };
    if (levels[logLevel] >= levels[level]) {
        const prefix = level === 'error' ? '❌' : level === 'info' ? 'ℹ️' : '🔍';
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        console.log(`${prefix} [${timestamp}] [SmartTable] ${message}`, data !== null && data !== void 0 ? data : '');
    }
}
/**
 * Warn if debug.slow is enabled in CI environment
 */
function warnIfDebugInCI(config) {
    var _a;
    if (process.env.CI === 'true' && ((_a = config.debug) === null || _a === void 0 ? void 0 : _a.slow)) {
        console.warn('⚠️  [SmartTable] Warning: debug.slow is enabled in CI environment.\n' +
            '   This will significantly slow down test execution.\n' +
            '   Consider disabling debug mode in CI.');
    }
}
