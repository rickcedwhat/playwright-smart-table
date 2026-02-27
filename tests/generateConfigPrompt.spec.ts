import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';
import { MINIMAL_CONFIG_CONTEXT } from '../src/minimalConfigContext';

test.describe('generateConfigPrompt', () => {
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

        // It should throw an error rather than just console.log
        await expect(table.generateConfigPrompt()).rejects.toThrow(/COPY INTO GEMINI/);

        try {
            await table.generateConfigPrompt();
        } catch (e: any) {
            const message = e.message;
            // Should contain the table HTML
            expect(message).toContain('Val 1');
            expect(message).toContain('Val 2');

            // Should contain the table HTML exactly as rendered
            expect(message).toContain(tableHTML.trim());

            // Should contain the TypeScript config types automatically
            expect(message).toContain(MINIMAL_CONFIG_CONTEXT);

            // Should prompt the user to copy into Gemini / ChatGPT
            expect(message).toContain('COPY INTO GEMINI / ChatGPT');
        }
    });
});
