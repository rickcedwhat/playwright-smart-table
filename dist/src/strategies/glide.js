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
exports.GlideStrategies = exports.glideGetActiveCell = exports.glideGetCellLocator = exports.glidePaginationStrategy = exports.glideFillStrategy = void 0;
const columns_1 = require("../../examples/glide-strategies/columns");
const headers_1 = require("../../examples/glide-strategies/headers");
const pagination_1 = require("./pagination");
const stabilization_1 = require("./stabilization");
const glideFillStrategy = (_a) => __awaiter(void 0, [_a], void 0, function* ({ value, page }) {
    // Edit Cell
    yield page.keyboard.press('Enter');
    // Wait for editor to appear
    const textarea = page.locator('textarea.gdg-input');
    yield textarea.waitFor({ state: 'visible', timeout: 2000 });
    yield page.keyboard.type(String(value));
    // Wait for textarea value to match what we typed
    yield textarea.evaluate((el, expectedValue) => {
        return new Promise((resolve) => {
            const checkValue = () => {
                if (el.value === expectedValue) {
                    resolve();
                }
                else {
                    setTimeout(checkValue, 10);
                }
            };
            checkValue();
        });
    }, String(value));
    // Small delay to let the grid process the value
    yield page.waitForTimeout(50);
    yield page.keyboard.press('Enter');
    // Wait for editor to close (commit completed)
    yield textarea.waitFor({ state: 'detached', timeout: 2000 });
    // Wait for accessibility layer to sync with canvas state
    yield page.waitForTimeout(300);
});
exports.glideFillStrategy = glideFillStrategy;
exports.glidePaginationStrategy = pagination_1.PaginationStrategies.infiniteScroll({
    scrollTarget: 'xpath=//ancestor::body//div[contains(@class, "dvn-scroller")]',
    scrollAmount: 500,
    action: 'js-scroll',
    stabilization: stabilization_1.StabilizationStrategies.contentChanged({ timeout: 5000 }),
    timeout: 5000 // Overall timeout
});
const glideGetCellLocator = ({ row, columnIndex }) => {
    // Use relative locator to support virtualization (where rowIndex resets or is offsets)
    // The accessibility DOM usually contains 'td' elements with the data.
    return row.locator('td').nth(columnIndex);
};
exports.glideGetCellLocator = glideGetCellLocator;
const glideGetActiveCell = (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
    // Find the focused cell/element
    // Use broad selector for focused element
    const focused = page.locator('*:focus').first();
    if ((yield focused.count()) === 0)
        return null;
    // Debug log
    if (process.env.DEBUG)
        console.log('Found focused element:', yield focused.evaluate((e) => e.outerHTML));
    // Try to extract position from ID if possible
    const id = (yield focused.getAttribute('id')) || '';
    // Expected format: glide-cell-COL-ROW
    const parts = id.split('-');
    let rowIndex = -1;
    let columnIndex = -1;
    if (parts.length >= 4 && parts[0] === 'glide' && parts[1] === 'cell') {
        columnIndex = parseInt(parts[2]) - 1; // 1-based in ID to 0-based
        rowIndex = parseInt(parts[3]);
    }
    else {
        // Fallback: If we can't parse ID, we assume it's the correct cell 
        // because we just navigated to it. 
        // Returning -1 indices might be confusing but won't stop smartRow from using the locator.
    }
    return {
        rowIndex,
        columnIndex,
        locator: focused
    };
});
exports.glideGetActiveCell = glideGetActiveCell;
exports.GlideStrategies = {
    fill: exports.glideFillStrategy,
    pagination: exports.glidePaginationStrategy,
    header: headers_1.scrollRightHeader,
    cellNavigation: columns_1.keyboardCellNavigation,
    getCellLocator: exports.glideGetCellLocator,
    getActiveCell: exports.glideGetActiveCell
};
