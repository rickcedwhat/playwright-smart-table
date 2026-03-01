/**
 * Internal symbol used to mark a SmartRow as a "sentinel" (row not found).
 * Use SmartRow.wasFound() to detect; do not rely on this symbol in user code.
 */
export const SENTINEL_ROW = Symbol.for('playwright-smart-table.sentinelRow');
