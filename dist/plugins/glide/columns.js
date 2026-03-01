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
exports.glideGoHome = exports.glideGoRight = exports.glideGoLeft = exports.glideGoDown = exports.glideGoUp = void 0;
/**
 * Primitive navigation functions for Glide Data Grid.
 * These define HOW to move, not WHEN to move.
 * The orchestration logic lives in _navigateToCell.
 */
const glideGoUp = (context) => __awaiter(void 0, void 0, void 0, function* () {
    yield context.page.keyboard.press('ArrowUp');
});
exports.glideGoUp = glideGoUp;
const glideGoDown = (context) => __awaiter(void 0, void 0, void 0, function* () {
    yield context.page.keyboard.press('ArrowDown');
});
exports.glideGoDown = glideGoDown;
const glideGoLeft = (context) => __awaiter(void 0, void 0, void 0, function* () {
    yield context.page.keyboard.press('ArrowLeft');
});
exports.glideGoLeft = glideGoLeft;
const glideGoRight = (context) => __awaiter(void 0, void 0, void 0, function* () {
    yield context.page.keyboard.press('ArrowRight');
});
exports.glideGoRight = glideGoRight;
const glideGoHome = (context) => __awaiter(void 0, void 0, void 0, function* () {
    const { root, page } = context;
    // Glide renders to canvas - the accessibility table (root) is inside the canvas
    yield root.evaluate((el) => {
        var _a;
        const canvas = el.closest('canvas') || ((_a = el.parentElement) === null || _a === void 0 ? void 0 : _a.querySelector('canvas'));
        if (canvas instanceof HTMLCanvasElement) {
            canvas.tabIndex = 0;
            canvas.focus();
        }
    });
    yield page.waitForTimeout(100);
    yield page.keyboard.press('Control+Home');
    yield page.keyboard.press('Meta+ArrowUp');
    yield page.keyboard.press('Home');
    yield page.waitForTimeout(150);
});
exports.glideGoHome = glideGoHome;
