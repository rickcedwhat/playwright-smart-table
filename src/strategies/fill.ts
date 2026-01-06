
import type { Locator } from '@playwright/test';
import type { FillStrategy } from '../types';

export const FillStrategies = {
    /**
     * Default strategy: Detects input type and fills accordingly (Text, Select, Checkbox, ContentEditable).
     */
    default: async ({ row, columnName, value, fillOptions }: Parameters<FillStrategy>[0]) => {
        const cell = row.getCell(columnName);

        // Use custom input mapper for this column if provided, otherwise auto-detect
        let inputLocator: Locator;
        if (fillOptions?.inputMappers?.[columnName]) {
            inputLocator = fillOptions.inputMappers[columnName](cell);
        } else {
            // Auto-detect input type
            // Check for text input
            const textInput = cell.locator('input[type="text"], input:not([type]), textarea').first();
            const textInputCount = await textInput.count().catch(() => 0);

            // Check for select
            const select = cell.locator('select').first();
            const selectCount = await select.count().catch(() => 0);

            // Check for checkbox/radio
            const checkbox = cell.locator('input[type="checkbox"], input[type="radio"], [role="checkbox"]').first();
            const checkboxCount = await checkbox.count().catch(() => 0);

            // Check for contenteditable or div-based inputs
            const contentEditable = cell.locator('[contenteditable="true"]').first();
            const contentEditableCount = await contentEditable.count().catch(() => 0);

            // Determine which input to use (prioritize by commonality)
            if (textInputCount > 0 && selectCount === 0 && checkboxCount === 0) {
                inputLocator = textInput;
            } else if (selectCount > 0) {
                inputLocator = select;
            } else if (checkboxCount > 0) {
                inputLocator = checkbox;
            } else if (contentEditableCount > 0) {
                inputLocator = contentEditable;
            } else if (textInputCount > 0) {
                // Fallback to text input even if others exist
                inputLocator = textInput;
            } else {
                // No input found - try to click the cell itself (might trigger an editor)
                inputLocator = cell;
            }
        }

        // Fill based on value type and input type
        const inputTag = await inputLocator.evaluate((el: Element) => el.tagName.toLowerCase()).catch(() => 'unknown');
        const inputType = await inputLocator.getAttribute('type').catch(() => null);
        const isContentEditable = await inputLocator.getAttribute('contenteditable').catch(() => null);

        // console.log(`[SmartTable] Filling "${columnName}" with value "${value}" (input: ${inputTag}, type: ${inputType})`);

        if (inputType === 'checkbox' || inputType === 'radio') {
            // Boolean value for checkbox/radio
            const shouldBeChecked = Boolean(value);
            const isChecked = await inputLocator.isChecked().catch(() => false);
            if (isChecked !== shouldBeChecked) {
                await inputLocator.click();
            }
        } else if (inputTag === 'select') {
            // Select dropdown
            await inputLocator.selectOption(String(value));
        } else if (isContentEditable === 'true') {
            // Contenteditable div
            await inputLocator.click();
            await inputLocator.fill(String(value));
        } else {
            // Text input, textarea, or generic
            await inputLocator.fill(String(value));
        }
    }
};
