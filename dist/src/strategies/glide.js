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
const virtualizedPagination_1 = require("./virtualizedPagination");
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
exports.glidePaginationStrategy = (0, virtualizedPagination_1.virtualizedInfiniteScroll)({
    // Use the overlay scroller (found via xpath from canvas root)
    scrollTarget: 'xpath=//ancestor::body//div[contains(@class, "dvn-scroller")]',
    scrollAmount: 500,
    stabilityTimeout: 200, // Wait for virtual rows to update
    useJsScroll: true, // Canvas/Virtual scrollers often need direct JS manipulation
    retries: 3 // Allow some time for the A11y layer to catch up
});
const glideGetCellLocator = ({ page, columnIndex, rowIndex }) => {
    // Glide uses 1-based colIndex for data cells (colIndex 0 is row header usually)
    // rowIndex seems to be 0-based in the ID based on "glide-cell-1-0"
    return page.locator(`#glide-cell-${columnIndex + 1}-${rowIndex}`);
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
