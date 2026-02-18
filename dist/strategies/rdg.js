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
exports.RDGStrategies = exports.rdgNavigation = exports.rdgPaginationStrategy = exports.rdgCellNavigation = exports.rdgGetCellLocator = exports.scrollRightHeaderRDG = void 0;
/**
 * Scrolls the grid horizontally to collect all column headers.
 * Handles empty headers by labeling them (e.g. "Checkbox").
 */
const scrollRightHeaderRDG = (context) => __awaiter(void 0, void 0, void 0, function* () {
    const { resolve, config, root, page } = context;
    const collectedHeaders = new Set();
    const gridHandle = yield root.evaluateHandle((el) => {
        return el.querySelector('[role="grid"]') || el.closest('[role="grid"]');
    });
    const scrollContainer = gridHandle; // RDG usually scrolls the grid container itself
    const expectedColumns = yield gridHandle.evaluate(el => el ? parseInt(el.getAttribute('aria-colcount') || '0', 10) : 0);
    const getVisible = () => __awaiter(void 0, void 0, void 0, function* () {
        const headerLoc = resolve(config.headerSelector, root);
        const texts = yield headerLoc.allInnerTexts();
        return texts.map(t => {
            const trimmed = t.trim();
            // Assign a name to empty headers (like selection checkboxes)
            return trimmed.length > 0 ? trimmed : 'Checkbox';
        });
    });
    let currentHeaders = yield getVisible();
    currentHeaders.forEach(h => collectedHeaders.add(h));
    const hasScroll = yield gridHandle.evaluate(el => el ? el.scrollWidth > el.clientWidth : false);
    if (hasScroll) {
        yield gridHandle.evaluate(el => el.scrollLeft = 0);
        yield page.waitForTimeout(200);
        let iteration = 0;
        // Safety break at 30 iterations to prevent infinite loops
        while (collectedHeaders.size < expectedColumns && iteration < 30) {
            yield gridHandle.evaluate(el => el.scrollLeft += 500);
            yield page.waitForTimeout(300);
            const newHeaders = yield getVisible();
            newHeaders.forEach(h => collectedHeaders.add(h));
            const atEnd = yield gridHandle.evaluate(el => el.scrollLeft >= el.scrollWidth - el.clientWidth - 10);
            iteration++;
            if (atEnd)
                break;
        }
        yield gridHandle.evaluate(el => el.scrollLeft = 0);
        yield page.waitForTimeout(200);
    }
    return Array.from(collectedHeaders);
});
exports.scrollRightHeaderRDG = scrollRightHeaderRDG;
/**
 * Uses a row-relative locator to avoid issues with absolute aria-rowindex
 * changing during pagination/scrolling.
 */
const rdgGetCellLocator = ({ row, columnIndex }) => {
    const ariaColIndex = columnIndex + 1;
    return row.locator(`[role="gridcell"][aria-colindex="${ariaColIndex}"]`);
};
exports.rdgGetCellLocator = rdgGetCellLocator;
/**
 * Scrolls virtualized columns into view before reading.
 */
const rdgCellNavigation = (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, page, index }) {
    // Check if the column header is visible and scroll horizontally if needed
    const headerCell = root.locator(`[role="columnheader"][aria-colindex="${index + 1}"]`);
    const isVisible = yield headerCell.isVisible().catch(() => false);
    if (!isVisible) {
        const estimatedScroll = index * 150;
        yield root.evaluate((el, scrollAmount) => {
            el.scrollLeft = scrollAmount;
        }, estimatedScroll);
        yield page.waitForTimeout(300);
    }
});
exports.rdgCellNavigation = rdgCellNavigation;
/**
 * Scrolls the grid vertically to load more virtualized rows.
 */
const pagination_1 = require("./pagination");
const stabilization_1 = require("./stabilization");
/**
 * Scrolls the grid vertically to load more virtualized rows.
 */
exports.rdgPaginationStrategy = pagination_1.PaginationStrategies.infiniteScroll({
    action: 'js-scroll',
    scrollAmount: 500,
    stabilization: stabilization_1.StabilizationStrategies.contentChanged({ timeout: 5000 })
});
exports.rdgNavigation = {
    goRight: (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, page }) {
        yield root.evaluate((el) => {
            // Find grid container
            const grid = el.querySelector('[role="grid"]') || el.closest('[role="grid"]') || el;
            if (grid)
                grid.scrollLeft += 150;
        });
    }),
    goLeft: (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, page }) {
        yield root.evaluate((el) => {
            const grid = el.querySelector('[role="grid"]') || el.closest('[role="grid"]') || el;
            if (grid)
                grid.scrollLeft -= 150;
        });
    }),
    goDown: (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, page }) {
        yield root.evaluate((el) => {
            const grid = el.querySelector('[role="grid"]') || el.closest('[role="grid"]') || el;
            if (grid)
                grid.scrollTop += 35;
        });
    }),
    goUp: (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, page }) {
        yield root.evaluate((el) => {
            const grid = el.querySelector('[role="grid"]') || el.closest('[role="grid"]') || el;
            if (grid)
                grid.scrollTop -= 35;
        });
    }),
    goHome: (_a) => __awaiter(void 0, [_a], void 0, function* ({ root, page }) {
        yield root.evaluate((el) => {
            const grid = el.querySelector('[role="grid"]') || el.closest('[role="grid"]') || el;
            if (grid) {
                grid.scrollLeft = 0;
                grid.scrollTop = 0;
            }
        });
    })
};
exports.RDGStrategies = {
    header: exports.scrollRightHeaderRDG,
    getCellLocator: exports.rdgGetCellLocator,
    cellNavigation: exports.rdgCellNavigation,
    navigation: exports.rdgNavigation,
    pagination: exports.rdgPaginationStrategy
};
