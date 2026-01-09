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
exports.ColumnStrategies = exports.CellNavigationStrategies = void 0;
exports.CellNavigationStrategies = {
    /**
     * Default strategy: Assumes column is accessible or standard scrolling works.
     * No specific action taken other than what Playwright's default locator handling does.
     */
    default: () => __awaiter(void 0, void 0, void 0, function* () {
        // No-op
    }),
    /**
     * Strategy that clicks into the table to establish focus and then uses the Right Arrow key
     * to navigate to the target CELL (navigates down to the row, then right to the column).
     *
     * Useful for canvas-based grids like Glide where DOM scrolling might not be enough for interaction
     * or where keyboard navigation is the primary way to move focus.
     */
    keyboard: (context) => __awaiter(void 0, void 0, void 0, function* () {
        const { root, page, index, rowLocator, rowIndex } = context;
        if (typeof rowIndex !== 'number') {
            throw new Error('Row index is required for keyboard navigation');
        }
        yield root.focus();
        yield page.waitForTimeout(100);
        // Robust Navigation:
        // 1. Jump to Top-Left (Reset) - Sequence for Cross-OS (Mac/Windows)
        yield page.keyboard.press('Control+Home');
        yield page.keyboard.press('Meta+ArrowUp'); // Mac Go-To-Top
        yield page.keyboard.press('Home'); // Ensure start of row
        yield page.waitForTimeout(150);
        // 2. Move Down to Target Row
        for (let i = 0; i < rowIndex; i++) {
            yield page.keyboard.press('ArrowDown');
        }
        // 3. Move Right to Target Column
        for (let i = 0; i < index; i++) {
            yield page.keyboard.press('ArrowRight');
        }
        yield page.waitForTimeout(50);
    })
};
// Backwards compatibility - deprecated
/** @deprecated Use CellNavigationStrategies instead */
exports.ColumnStrategies = exports.CellNavigationStrategies;
