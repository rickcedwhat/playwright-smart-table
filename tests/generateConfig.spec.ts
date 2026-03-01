import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';
import { MINIMAL_CONFIG_CONTEXT } from '../src/minimalConfigContext';

test.describe('generateConfig', () => {
    test('should throw an error containing the prompt and TypeScript types', async ({ page }) => {
        const tableHTML = `
            <table id="my-table">
                <thead><tr><th>Col 1</th><th>Col 2</th></tr></thead>
                <tbody>
                    <tr><td>Val 1</td><td>Val 2</td></tr>
                </tbody>
            </table>
        `;
        await page.setContent(tableHTML);

        const table = useTable(page.locator('#my-table'));

        await expect(table.generateConfig()).rejects.toThrow(/COPY INTO GEMINI/);

        try {
            await table.generateConfig();
        } catch (e: any) {
            const message = e.message;
            expect(message).toContain('Val 1');
            expect(message).toContain('Val 2');
            expect(message).toContain(tableHTML.trim());
            expect(message).toContain(MINIMAL_CONFIG_CONTEXT);
            expect(message).toContain('COPY INTO GEMINI / ChatGPT');
        }
    });

    test('generateConfigPrompt (deprecated) delegates to generateConfig', async ({ page }) => {
        await page.setContent(`
            <table id="t"><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
        `);
        const table = useTable(page.locator('#t'));

        await expect(table.generateConfigPrompt()).rejects.toThrow(/COPY INTO GEMINI/);
        // Implementation also calls console.warn with deprecation message
    });
});
