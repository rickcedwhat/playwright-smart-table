import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';
import { Strategies } from '../src/strategies';

test('Debug: Check pagination button', async ({ page }) => {
    await page.goto("https://mui.com/material-ui/react-table/");
    await page.locator('.MuiDataGrid-root').first().scrollIntoViewIfNeeded();

    const tableLocator = page.locator(".MuiDataGrid-root").first();

    // First, let's manually check if the button exists
    const nextButton = tableLocator.getByRole("button", { name: "Go to next page" });
    console.log("Next button count:", await nextButton.count());

    if (await nextButton.count() > 0) {
        console.log("✅ Next button found");
        console.log("Is enabled:", await nextButton.isEnabled());
        console.log("Is visible:", await nextButton.isVisible());
    } else {
        console.log("❌ Next button NOT found");
        // Let's see what buttons are available
        const allButtons = await tableLocator.getByRole("button").all();
        console.log(`Found ${allButtons.length} buttons in table`);
        for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
            const text = await allButtons[i].textContent();
            const label = await allButtons[i].getAttribute('aria-label');
            console.log(`  Button ${i}: text="${text}", aria-label="${label}"`);
        }
    }

    // Now let's check what data is actually in the table
    const table = useTable(tableLocator, {
        rowSelector: ".MuiDataGrid-row",
        headerSelector: ".MuiDataGrid-columnHeader",
        cellSelector: ".MuiDataGrid-cell",
        headerTransformer: ({ text }) => text.includes('__col_') ? "Actions" : text,
        debug: true
    });

    await table.init();

    // Get all last names on the current page
    const lastNames = await table.getColumnValues("Last name");
    console.log("Last names on page 1:", lastNames);
    console.log("Is 'Clifford' on page 1?", lastNames.includes("Clifford"));
});
