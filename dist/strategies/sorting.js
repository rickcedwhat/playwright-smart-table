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
                    const { getHeaderCell } = context;
                    if (!getHeaderCell)
                        throw new Error('getHeaderCell is required in StrategyContext for sorting.');
                    // The table engine handles verify-and-retry. We only provide the trigger here.
                    const targetHeader = yield getHeaderCell(columnName);
                    yield targetHeader.click();
                });
            },
            getSortState(_a) {
                return __awaiter(this, arguments, void 0, function* ({ columnName, context }) {
                    const { getHeaderCell } = context;
                    try {
                        if (!getHeaderCell)
                            throw new Error('getHeaderCell is required');
                        const targetHeader = yield getHeaderCell(columnName);
                        const ariaSort = yield targetHeader.getAttribute('aria-sort');
                        if (ariaSort === 'ascending')
                            return 'asc';
                        if (ariaSort === 'descending')
                            return 'desc';
                        return 'none';
                    }
                    catch (_b) {
                        return 'none'; // Header not found, so it's not sorted
                    }
                });
            },
        };
    },
};
