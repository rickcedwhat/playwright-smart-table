"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SENTINEL_ROW = void 0;
/**
 * Internal symbol used to mark a SmartRow as a "sentinel" (row not found).
 * Use SmartRow.wasFound() to detect; do not rely on this symbol in user code.
 */
exports.SENTINEL_ROW = Symbol.for('playwright-smart-table.sentinelRow');
