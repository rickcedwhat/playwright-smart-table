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
exports.FillStrategies = void 0;
exports.FillStrategies = {
    /**
     * Default strategy: Detects input type and fills accordingly (Text, Select, Checkbox, ContentEditable).
     */
    default: (_a) => __awaiter(void 0, [_a], void 0, function* ({ row, columnName, value, fillOptions, config, table }) {
        var _b, _c;
        const cell = row.getCell(columnName);
        // 1. Check for Unified Column Override
        const columnOverride = (_b = config === null || config === void 0 ? void 0 : config.columnOverrides) === null || _b === void 0 ? void 0 : _b[columnName];
        if (columnOverride === null || columnOverride === void 0 ? void 0 : columnOverride.write) {
            let currentValue;
            // Auto-sync: If read exists, fetch current state first
            if (columnOverride.read) {
                currentValue = yield columnOverride.read(cell);
            }
            yield columnOverride.write({
                cell,
                targetValue: value,
                currentValue,
                row
            });
            return;
        }
        // Use custom input mapper for this column if provided, otherwise auto-detect
        let inputLocator;
        if ((_c = fillOptions === null || fillOptions === void 0 ? void 0 : fillOptions.inputMappers) === null || _c === void 0 ? void 0 : _c[columnName]) {
            inputLocator = fillOptions.inputMappers[columnName](cell);
        }
        else {
            // Auto-detect input type
            // Check for text input
            const textInput = cell.locator('input[type="text"], input:not([type]), textarea').first();
            const textInputCount = yield textInput.count().catch(() => 0);
            // Check for select
            const select = cell.locator('select').first();
            const selectCount = yield select.count().catch(() => 0);
            // Check for checkbox/radio
            const checkbox = cell.locator('input[type="checkbox"], input[type="radio"], [role="checkbox"]').first();
            const checkboxCount = yield checkbox.count().catch(() => 0);
            // Check for contenteditable or div-based inputs
            const contentEditable = cell.locator('[contenteditable="true"]').first();
            const contentEditableCount = yield contentEditable.count().catch(() => 0);
            // Determine which input to use (prioritize by commonality)
            if (textInputCount > 0 && selectCount === 0 && checkboxCount === 0) {
                inputLocator = textInput;
            }
            else if (selectCount > 0) {
                inputLocator = select;
            }
            else if (checkboxCount > 0) {
                inputLocator = checkbox;
            }
            else if (contentEditableCount > 0) {
                inputLocator = contentEditable;
            }
            else if (textInputCount > 0) {
                // Fallback to text input even if others exist
                inputLocator = textInput;
            }
            else {
                // No input found - try to click the cell itself (might trigger an editor)
                inputLocator = cell;
            }
        }
        // Fill based on value type and input type
        const inputTag = yield inputLocator.evaluate((el) => el.tagName.toLowerCase()).catch(() => 'unknown');
        const inputType = yield inputLocator.getAttribute('type').catch(() => null);
        const isContentEditable = yield inputLocator.getAttribute('contenteditable').catch(() => null);
        // console.log(`[SmartTable] Filling "${columnName}" with value "${value}" (input: ${inputTag}, type: ${inputType})`);
        if (inputType === 'checkbox' || inputType === 'radio') {
            // Boolean value for checkbox/radio
            const shouldBeChecked = Boolean(value);
            const isChecked = yield inputLocator.isChecked().catch(() => false);
            if (isChecked !== shouldBeChecked) {
                yield inputLocator.click();
            }
        }
        else if (inputTag === 'select') {
            // Select dropdown
            yield inputLocator.selectOption(String(value));
        }
        else if (isContentEditable === 'true') {
            // Contenteditable div
            yield inputLocator.click();
            yield inputLocator.fill(String(value));
        }
        else {
            // Text input, textarea, or generic
            yield inputLocator.fill(String(value));
        }
    })
};
