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
exports.Glide = exports.GlideStrategies = void 0;
const columns_1 = require("./columns");
const headers_1 = require("./headers");
const pagination_1 = require("../../strategies/pagination");
const stabilization_1 = require("../../strategies/stabilization");
const glideFillStrategy = (_a) => __awaiter(void 0, [_a], void 0, function* ({ value, page }) {
    yield page.keyboard.press('Enter');
    const textarea = page.locator('textarea.gdg-input');
    yield textarea.waitFor({ state: 'visible', timeout: 2000 });
    yield page.keyboard.type(String(value));
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
    yield page.waitForTimeout(50);
    yield page.keyboard.press('Enter');
    yield textarea.waitFor({ state: 'detached', timeout: 2000 });
    yield page.waitForTimeout(300);
});
const glideFillSimple = (_a) => __awaiter(void 0, [_a], void 0, function* ({ value, page }) {
    yield page.keyboard.press('Enter');
    yield page.keyboard.type(String(value));
    yield page.keyboard.press('Enter');
});
const glidePaginationStrategy = pagination_1.PaginationStrategies.infiniteScroll({
    scrollTarget: 'xpath=//ancestor::body//div[contains(@class, "dvn-scroller")]',
    scrollAmount: 500,
    action: 'js-scroll',
    stabilization: stabilization_1.StabilizationStrategies.contentChanged({ timeout: 5000 }),
    timeout: 5000
});
const glideGetCellLocator = ({ row, columnIndex }) => {
    return row.locator('td').nth(columnIndex);
};
const glideGetActiveCell = (_a) => __awaiter(void 0, [_a], void 0, function* ({ page }) {
    const focused = page.locator('*:focus').first();
    if ((yield focused.count()) === 0)
        return null;
    const id = (yield focused.getAttribute('id')) || '';
    const parts = id.split('-');
    let rowIndex = -1;
    let columnIndex = -1;
    if (parts.length >= 4 && parts[0] === 'glide' && parts[1] === 'cell') {
        columnIndex = parseInt(parts[2]) - 1;
        rowIndex = parseInt(parts[3]);
    }
    return {
        rowIndex,
        columnIndex,
        locator: focused
    };
});
/** Default strategies for the Glide preset (fill only; no fillSimple). */
const GlideDefaultStrategies = {
    fill: glideFillStrategy,
    pagination: glidePaginationStrategy,
    header: headers_1.scrollRightHeader,
    navigation: {
        goUp: columns_1.glideGoUp,
        goDown: columns_1.glideGoDown,
        goLeft: columns_1.glideGoLeft,
        goRight: columns_1.glideGoRight,
        goHome: columns_1.glideGoHome
    },
    loading: {
        isHeaderLoading: () => __awaiter(void 0, void 0, void 0, function* () { return false; })
    },
    getCellLocator: glideGetCellLocator,
    getActiveCell: glideGetActiveCell
};
/** Strategies only for Glide Data Grid. Includes fillSimple; use when you want to supply your own selectors or override fill. */
exports.GlideStrategies = Object.assign(Object.assign({}, GlideDefaultStrategies), { fillSimple: glideFillSimple });
/**
 * Full preset for Glide Data Grid (selectors + default strategies only).
 * Spread: useTable(loc, { ...Plugins.Glide, maxPages: 5 }).
 * Strategies only (including fillSimple): useTable(loc, { rowSelector: '...', strategies: Plugins.Glide.Strategies }).
 */
const GlidePreset = {
    headerSelector: 'table[role="grid"] thead tr th',
    rowSelector: 'table[role="grid"] tbody tr',
    cellSelector: 'td',
    strategies: GlideDefaultStrategies
};
exports.Glide = Object.defineProperty(GlidePreset, 'Strategies', { get: () => exports.GlideStrategies, enumerable: false });
