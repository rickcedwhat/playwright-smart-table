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
exports.createSmartRow = void 0;
const fill_1 = require("./strategies/fill");
/**
 * Factory to create a SmartRow by extending a Playwright Locator.
 * We avoid Class/Proxy to ensure full compatibility with Playwright's expect(locator) matchers.
 */
const createSmartRow = (rowLocator, map, rowIndex, config, rootLocator, resolve, table) => {
    const smart = rowLocator;
    // Attach State
    smart.rowIndex = rowIndex;
    smart.getRequestIndex = () => rowIndex;
    // Attach Methods
    smart.getCell = (colName) => {
        const idx = map.get(colName);
        if (idx === undefined) {
            const availableColumns = Array.from(map.keys());
            throw new Error(`Column "${colName}" not found. Available: ${availableColumns.join(', ')}`);
        }
        if (config.strategies.getCellLocator) {
            return config.strategies.getCellLocator({
                row: rowLocator,
                columnName: colName,
                columnIndex: idx,
                rowIndex: rowIndex,
                page: rootLocator.page()
            });
        }
        return resolve(config.cellSelector, rowLocator).nth(idx);
    };
    smart.toJSON = (options) => __awaiter(void 0, void 0, void 0, function* () {
        const result = {};
        const page = rootLocator.page();
        for (const [col, idx] of map.entries()) {
            if ((options === null || options === void 0 ? void 0 : options.columns) && !options.columns.includes(col)) {
                continue;
            }
            // Get the cell locator
            const cell = config.strategies.getCellLocator
                ? config.strategies.getCellLocator({
                    row: rowLocator,
                    columnName: col,
                    columnIndex: idx,
                    rowIndex: rowIndex,
                    page: page
                })
                : resolve(config.cellSelector, rowLocator).nth(idx);
            let targetCell = cell;
            // Check if cell exists
            const count = yield cell.count();
            if (count === 0) {
                // Optimization: Check if we are ALREADY at the target cell
                if (config.strategies.getActiveCell) {
                    const active = yield config.strategies.getActiveCell({
                        config,
                        root: rootLocator,
                        page,
                        resolve
                    });
                    if (active && active.rowIndex === rowIndex && active.columnIndex === idx) {
                        if (config.debug)
                            console.log(`[SmartRow] Already at target cell (r:${active.rowIndex}, c:${active.columnIndex}), skipping navigation.`);
                        targetCell = active.locator;
                        // Skip navigation and go to reading text
                        const text = yield targetCell.innerText();
                        result[col] = (text || '').trim();
                        continue;
                    }
                }
                // Cell doesn't exist - navigate to it
                if (config.debug) {
                    console.log(`[SmartRow.toJSON] Cell not found for column "${col}" (index ${idx}), navigating...`);
                }
                yield config.strategies.cellNavigation({
                    config: config,
                    root: rootLocator,
                    page: page,
                    resolve: resolve,
                    column: col,
                    index: idx,
                    rowLocator: rowLocator,
                    rowIndex: rowIndex
                });
                // Optimization: check if we can get the active cell directly
                if (config.strategies.getActiveCell) {
                    const activeCell = yield config.strategies.getActiveCell({
                        config,
                        root: rootLocator,
                        page,
                        resolve
                    });
                    if (activeCell) {
                        if (config.debug) {
                            console.log(`[SmartRow.toJSON] switching to active cell locator (r:${activeCell.rowIndex}, c:${activeCell.columnIndex})`);
                        }
                        targetCell = activeCell.locator;
                    }
                }
            }
            const text = yield targetCell.innerText();
            result[col] = (text || '').trim();
        }
        return result;
    });
    // @ts-ignore
    smart.fill = (data, fillOptions) => __awaiter(void 0, void 0, void 0, function* () {
        for (const [colName, value] of Object.entries(data)) {
            const colIdx = map.get(colName);
            if (colIdx === undefined) {
                throw new Error(`Column "${colName}" not found in fill data.`);
            }
            yield config.strategies.cellNavigation({
                config: config,
                root: rootLocator,
                page: rootLocator.page(),
                resolve: resolve,
                column: colName,
                index: colIdx,
                rowLocator: rowLocator,
                rowIndex: rowIndex
            });
            const strategy = config.strategies.fill || fill_1.FillStrategies.default;
            yield strategy({
                row: smart,
                columnName: colName,
                value,
                index: rowIndex !== null && rowIndex !== void 0 ? rowIndex : -1,
                page: rowLocator.page(),
                rootLocator,
                table: table,
                fillOptions
            });
        }
    });
    smart.bringIntoView = () => __awaiter(void 0, void 0, void 0, function* () {
        if (rowIndex === undefined) {
            throw new Error('Cannot bring row into view - row index is unknown. Use getByRowIndex() instead of getByRow().');
        }
        // Scroll row into view using Playwright's built-in method
        yield rowLocator.scrollIntoViewIfNeeded();
    });
    smart.smartFill = smart.fill;
    return smart;
};
exports.createSmartRow = createSmartRow;
