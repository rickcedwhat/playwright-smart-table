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
exports.HeaderStrategies = void 0;
exports.HeaderStrategies = {
    /**
     * Default strategy: Returns only the headers currently visible in the DOM.
     * This is fast but won't find virtualized columns off-screen.
     */
    visible: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, resolve, root }) {
        const headerLoc = resolve(config.headerSelector, root);
        try {
            // Wait for at least one header to be visible
            yield headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
        }
        catch (e) {
            // Ignore hydration/timeout issues, return what we have
        }
        const texts = yield headerLoc.allInnerTexts();
        return texts.map(t => t.trim());
    })
};
