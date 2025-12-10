import { test, expect } from '@playwright/test';
import { useTable } from '../src/useTable';

test('The Internet Herokuapp - Standard Table', async ({ page }) => {
  //--------------------------------
  // Arrange:
  //--------------------------------
  await page.goto("https://the-internet.herokuapp.com/tables");

  // 1. Setup the helper
  // We select the second table (.nth(1)) just like your snippet
  const tableLocator = page.getByRole("table").nth(1);
  
  // No config needed! Defaults (tbody tr, th, td) work perfectly here.
  const table = useTable(tableLocator);

  //--------------------------------
  // Act & Assert:
  //--------------------------------

  // OPTION A: Check a specific value (Cleaner)
  // This verifies that the row with Last Name "Doe" has the Email "jdoe@hotmail.com"
  await expect(
    await table.getByCell({ "Last Name": "Doe" }, "Email")
  ).toHaveText("jdoe@hotmail.com");

  // OPTION B: Interact with the whole row
  // getByRow returns the standard Locator for that specific TR
  const row = await table.getByRow({ "Last Name": "Doe" });

  // Example: Verify visibility
  await expect(row).toBeVisible();

  // Example: Verify the 'edit' link is inside this specific row
  // (We use toBeVisible instead of click just to keep the test safe/repeatable)
  await expect(row.getByRole('link', { name: 'edit' })).toBeVisible();
});