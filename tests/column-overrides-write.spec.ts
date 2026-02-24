import { test, expect } from '@playwright/test';
import { useTable } from '../src/index';

test.describe('columnOverrides > write', () => {
    test('should override smartFill logic for specific columns using custom write', async ({ page }) => {
        const tableHTML = `
            <table id="my-table">
                <thead><tr><th>Name</th><th>Role</th><th>Tags</th></tr></thead>
                <tbody>
                    <tr>
                        <td>Alice</td>
                        <td>
                            <select class="role-select">
                                <option value="admin">Admin</option>
                                <option value="user" selected>User</option>
                            </select>
                        </td>
                        <td>
                            <div class="tags-container" data-tags="dev">dev</div>
                        </td>
                    </tr>
                </tbody>
            </table>
        `;
        await page.setContent(tableHTML);

        let overriddenWriteFired = false;
        let providedCurrentValue: string | undefined;

        const table = useTable(page.locator('#my-table'), {
            columnOverrides: {
                Tags: {
                    read: async (cell) => {
                        const container = cell.locator('.tags-container');
                        return await container.getAttribute('data-tags') ?? '';
                    },
                    write: async ({ cell, targetValue, currentValue, row }) => {
                        overriddenWriteFired = true;
                        providedCurrentValue = currentValue;
                        // Custom interaction to "write" the tag
                        const container = cell.locator('.tags-container');
                        await container.evaluate((el: HTMLElement, val: string) => {
                            el.setAttribute('data-tags', val);
                            el.innerText = val;
                        }, targetValue);
                    }
                }
            }
        });

        const row = await table.findRow({ Name: 'Alice' });

        // Use smartFill. The "Role" column should use default logic (native select),
        // but the "Tags" column should hit our custom write function.
        await row.smartFill({
            Role: 'admin',
            Tags: 'dev,lead'
        });

        expect(overriddenWriteFired).toBe(true);
        expect(providedCurrentValue).toBe('dev'); // From the read override

        // Verify native fill worked
        const roleVal = await page.locator('.role-select').inputValue();
        expect(roleVal).toBe('admin');

        // Verify custom write worked
        const tagsVal = await page.locator('.tags-container').getAttribute('data-tags');
        expect(tagsVal).toBe('dev,lead');
    });
});
