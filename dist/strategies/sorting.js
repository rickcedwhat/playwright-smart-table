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
exports.SortingStrategies = void 0;
/**
 * A collection of pre-built sorting strategies.
 */
exports.SortingStrategies = {
    /**
     * A sorting strategy that interacts with column headers based on ARIA attributes.
     * - `doSort`: Clicks the header repeatedly until the desired `aria-sort` state is achieved.
     * - `getSortState`: Reads the `aria-sort` attribute from the header.
     */
    AriaSort: () => {
        return {
            doSort(_a) {
                return __awaiter(this, arguments, void 0, function* ({ columnName, direction, context }) {
                    const { resolve, config, root } = context;
                    const headerLoc = resolve(config.headerSelector, root);
                    const headers = yield headerLoc.all();
                    const headerTexts = yield Promise.all(headers.map(h => h.innerText()));
                    const columnIndex = headerTexts.findIndex(text => text.trim() === columnName);
                    if (columnIndex === -1) {
                        throw new Error(`[AriaSort] Header with text "${columnName}" not found.`);
                    }
                    const targetHeader = headers[columnIndex];
                    // Click repeatedly to cycle through sort states
                    for (let i = 0; i < 3; i++) { // Max 3 clicks to prevent infinite loops (none -> asc -> desc)
                        const currentState = yield targetHeader.getAttribute('aria-sort');
                        const mappedState = currentState === 'ascending' ? 'asc' : currentState === 'descending' ? 'desc' : 'none';
                        if (mappedState === direction) {
                            return; // Desired state achieved
                        }
                        yield targetHeader.click();
                    }
                    throw new Error(`[AriaSort] Could not achieve sort direction "${direction}" for column "${columnName}" after 3 clicks.`);
                });
            },
            getSortState(_a) {
                return __awaiter(this, arguments, void 0, function* ({ columnName, context }) {
                    const { resolve, config, root } = context;
                    const headerLoc = resolve(config.headerSelector, root);
                    const headers = yield headerLoc.all();
                    const headerTexts = yield Promise.all(headers.map(h => h.innerText()));
                    const columnIndex = headerTexts.findIndex(text => text.trim() === columnName);
                    if (columnIndex === -1) {
                        return 'none'; // Header not found, so it's not sorted
                    }
                    const targetHeader = headers[columnIndex];
                    const ariaSort = yield targetHeader.getAttribute('aria-sort');
                    if (ariaSort === 'ascending')
                        return 'asc';
                    if (ariaSort === 'descending')
                        return 'desc';
                    return 'none';
                });
            },
        };
    },
};
