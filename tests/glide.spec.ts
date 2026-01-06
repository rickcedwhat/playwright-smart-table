
import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test.describe('Glide Table', () => {
    test('should interact with Glide-like grid structure', async ({ page }) => {
        // Inject the user's provided HTML
        await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
            table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Glide Table Demo</h1>
        <div id="table-container">
            <table role="grid" aria-rowcount="11" aria-multiselectable="true" aria-colcount="6">
                <thead role="rowgroup">
                    <tr role="row" aria-rowindex="1">
                        <th role="columnheader" aria-selected="false" aria-colindex="1" tabindex="-1">Name</th>
                        <th role="columnheader" aria-selected="false" aria-colindex="2" tabindex="-1">Description</th>
                        <th role="columnheader" aria-selected="false" aria-colindex="3" tabindex="-1">Image</th>
                        <th role="columnheader" aria-selected="false" aria-colindex="4" tabindex="-1">Category</th>
                        <th role="columnheader" aria-selected="false" aria-colindex="5" tabindex="-1">Email</th>
                        <th role="columnheader" aria-selected="false" aria-colindex="6" tabindex="-1">Is Favorited?</th>
                    </tr>
                </thead>
                <tbody role="rowgroup">
                    <tr role="row" aria-selected="false" aria-rowindex="2">
                        <td role="gridcell" aria-colindex="1" id="glide-cell-1-0">Item Title</td>
                        <td role="gridcell" aria-colindex="2" id="glide-cell-2-0">A short description of the item</td>
                        <td role="gridcell" aria-colindex="3" id="glide-cell-3-0">Image.png</td>
                        <td role="gridcell" aria-colindex="4" id="glide-cell-4-0">Category 1</td>
                        <td role="gridcell" aria-colindex="5" id="glide-cell-5-0"></td>
                        <td role="gridcell" aria-colindex="6" id="glide-cell-6-0">false</td>
                    </tr>
                    <tr role="row" aria-selected="false" aria-rowindex="3">
                        <td role="gridcell" aria-colindex="1" id="glide-cell-1-1">Item Title 2</td>
                        <td role="gridcell" aria-colindex="2" id="glide-cell-2-1">Another description</td>
                        <td role="gridcell" aria-colindex="3" id="glide-cell-3-1">Image2.png</td>
                        <td role="gridcell" aria-colindex="4" id="glide-cell-4-1">Category 2</td>
                        <td role="gridcell" aria-colindex="5" id="glide-cell-5-1">bob@example.com</td>
                        <td role="gridcell" aria-colindex="6" id="glide-cell-6-1">true</td>
                    </tr>
                </tbody>
            </table>
        </div>
      </body>
      </html>
    `);

        const table = useTable(page.locator('table[role="grid"]'), {
            // Specific selectors derived from the HTML structure
            headerSelector: 'thead[role="rowgroup"] th[role="columnheader"]',
            rowSelector: 'tbody[role="rowgroup"] tr[role="row"]',
            cellSelector: 'td[role="gridcell"]'
        });

        await table.init();

        // Verify headers
        const headers = await table.getHeaders();
        expect(headers).toEqual(['Name', 'Description', 'Image', 'Category', 'Email', 'Is Favorited?']);

        // Verify Row 1
        const row1 = table.getByRow({ Category: 'Category 1' });
        const row1Data = await row1.toJSON();
        expect(row1Data.Name).toBe('Item Title');
        expect(row1Data['Is Favorited?']).toBe('false');

        // Verify Row 2
        const row2 = table.getByRow({ Category: 'Category 2' });
        const row2Data = await row2.toJSON();
        expect(row2Data.Name).toBe('Item Title 2');
        expect(row2Data.Email).toBe('bob@example.com');
    });
});
