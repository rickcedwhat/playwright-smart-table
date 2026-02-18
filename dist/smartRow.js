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
const stringUtils_1 = require("./utils/stringUtils");
const debugUtils_1 = require("./utils/debugUtils");
/**
 * Internal helper to navigate to a cell with active cell optimization.
 * Uses navigation primitives (goUp, goDown, goLeft, goRight, goHome) for orchestration.
 * Falls back to cellNavigation for backward compatibility.
 * Returns the target cell locator after navigation.
 */
const _navigateToCell = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { config, rootLocator, page, resolve, column, index, rowLocator, rowIndex } = params;
    // Get active cell if strategy is available
    let activeCell = null;
    if (config.strategies.getActiveCell) {
        activeCell = yield config.strategies.getActiveCell({
            config,
            root: rootLocator,
            page,
            resolve
        });
        // Optimization: Check if we are ALREADY at the target cell
        if (activeCell && activeCell.rowIndex === rowIndex && activeCell.columnIndex === index) {
            // Skip navigation - we're already there!
            return activeCell.locator;
        }
    }
    const context = { config, root: rootLocator, page, resolve };
    // Use navigation primitives if available
    if (config.strategies.navigation) {
        const nav = config.strategies.navigation;
        if (typeof rowIndex !== 'number') {
            throw new Error('Row index is required for navigation');
        }
        // Determine starting position
        let startRow = 0;
        let startCol = 0;
        if (activeCell && activeCell.rowIndex >= 0 && activeCell.columnIndex >= 0) {
            // Use current position
            startRow = activeCell.rowIndex;
            startCol = activeCell.columnIndex;
        }
        else if (nav.goHome) {
            // Reset to top-left
            yield nav.goHome(context);
        }
        // Calculate movement needed
        const rowDiff = rowIndex - startRow;
        const colDiff = index - startCol;
        // Navigate vertically
        for (let i = 0; i < Math.abs(rowDiff); i++) {
            if (rowDiff > 0 && nav.goDown) {
                yield nav.goDown(context);
            }
            else if (rowDiff < 0 && nav.goUp) {
                yield nav.goUp(context);
            }
        }
        // Navigate horizontally
        for (let i = 0; i < Math.abs(colDiff); i++) {
            if (colDiff > 0 && nav.goRight) {
                yield nav.goRight(context);
            }
            else if (colDiff < 0 && nav.goLeft) {
                yield nav.goLeft(context);
            }
        }
        yield page.waitForTimeout(50);
        // Get the active cell locator after navigation (for virtualized tables)
        if (config.strategies.getActiveCell) {
            const updatedActiveCell = yield config.strategies.getActiveCell({
                config,
                root: rootLocator,
                page,
                resolve
            });
            if (updatedActiveCell) {
                return updatedActiveCell.locator;
            }
        }
        return null;
    }
    ;
    return null;
});
/**
 * Factory to create a SmartRow by extending a Playwright Locator.
 * We avoid Class/Proxy to ensure full compatibility with Playwright's expect(locator) matchers.
 */
const createSmartRow = (rowLocator, map, rowIndex, config, rootLocator, resolve, table) => {
    const smart = rowLocator;
    // Attach State
    smart.rowIndex = rowIndex;
    // Attach Methods
    smart.getCell = (colName) => {
        const idx = map.get(colName);
        if (idx === undefined) {
            throw new Error((0, stringUtils_1.buildColumnNotFoundError)(colName, Array.from(map.keys())));
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
        var _a;
        const result = {};
        const page = rootLocator.page();
        for (const [col, idx] of map.entries()) {
            if ((options === null || options === void 0 ? void 0 : options.columns) && !options.columns.includes(col)) {
                continue;
            }
            // Check if we have a data mapper for this column
            const mapper = (_a = config.dataMapper) === null || _a === void 0 ? void 0 : _a[col];
            if (mapper) {
                // Use custom mapper
                // Ensure we have the cell first (same navigation logic)
                // ... wait, the navigation logic below assumes we need to navigate.
                // If we have a mapper, we still need the cell locator.
                // Let's reuse the navigation logic to get targetCell
            }
            // --- Navigation Logic Start ---
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
            const count = yield cell.count();
            if (count === 0) {
                // Cell not in DOM (virtualized) - navigate to it
                const navigatedCell = yield _navigateToCell({
                    config,
                    rootLocator,
                    page,
                    resolve,
                    column: col,
                    index: idx,
                    rowLocator,
                    rowIndex
                });
                if (navigatedCell) {
                    targetCell = navigatedCell;
                }
            }
            // --- Navigation Logic End ---
            if (mapper) {
                // Apply mapper
                const mappedValue = yield mapper(targetCell);
                result[col] = mappedValue;
            }
            else {
                // Default string extraction
                const text = yield targetCell.innerText();
                result[col] = (text || '').trim();
            }
        }
        return result;
    });
    smart.smartFill = (data, fillOptions) => __awaiter(void 0, void 0, void 0, function* () {
        (0, debugUtils_1.logDebug)(config, 'info', 'Filling row', data);
        for (const [colName, value] of Object.entries(data)) {
            if (value === undefined)
                continue;
            const colIdx = map.get(colName);
            if (colIdx === undefined) {
                throw new Error((0, stringUtils_1.buildColumnNotFoundError)(colName, Array.from(map.keys())));
            }
            yield _navigateToCell({
                config,
                rootLocator,
                page: rootLocator.page(),
                resolve,
                column: colName,
                index: colIdx,
                rowLocator,
                rowIndex
            });
            const strategy = config.strategies.fill || fill_1.FillStrategies.default;
            (0, debugUtils_1.logDebug)(config, 'verbose', `Filling cell "${colName}" with value`, value);
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
            // Delay after filling
            yield (0, debugUtils_1.debugDelay)(config, 'getCell');
        }
        (0, debugUtils_1.logDebug)(config, 'info', 'Row fill complete');
    });
    smart.bringIntoView = () => __awaiter(void 0, void 0, void 0, function* () {
        if (rowIndex === undefined) {
            throw new Error('Cannot bring row into view - row index is unknown. Use getRowByIndex() instead of getRow().');
        }
        // Scroll row into view using Playwright's built-in method
        yield rowLocator.scrollIntoViewIfNeeded();
    });
    return smart;
};
exports.createSmartRow = createSmartRow;
