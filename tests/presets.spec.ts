import { test, expect } from '@playwright/test';
import { useForm, useMenu } from '../src/presets';

test.describe('Presets & Overrides', () => {

  test('useForm: Standard & Custom Selectors', async ({ page }) => {
    // 1. Arrange: A weird form using Paragraphs <p> instead of divs
    await page.setContent(`
      <form id="weird-form">
        <p class="field">
          <strong>User</strong>
          <input name="u" />
        </p>
        <p class="field">
          <strong>Pass</strong>
          <input name="p" />
        </p>
      </form>
    `);

    // 2. Initialize with OVERRIDE using STRING selector instead of function
    // This leverages the robust string-path logic in useTable
    const form = useForm(page.locator('#weird-form'), {
      rowSelector: 'p.field', // Override the default 'div.form-group'
      // Override cellSelector to be a string. 
      // '> *' selects direct children (Label is 1st, Input is 2nd)
      cellSelector: '> *' 
    });

    // 3. Act: It should still work as a Key-Value table
    // The library will now use locator('p.field').locator('> *:nth-child(2)') logic
    const inputCell = await form.getByCell({ Label: 'User' }, 'Input');
    
    // DEBUGGING: Check what we actually found
    // We expect this to be the <input> element directly, or its wrapper
    try {
        const html = await inputCell.evaluate(el => el.outerHTML);
        console.log('DEBUG: Found Input Cell HTML:', html);
    } catch (e) {
        console.log('DEBUG: Failed to evaluate cell HTML. Locator might be empty.');
    }

    await expect(inputCell).toBeVisible();

    // Since inputCell is the cell itself (which might be the input or contain it), 
    // we should fill it. If the cell IS the input, we fill it directly.
    // If the cell wraps the input, we locate 'input' inside it.
    
    // Check if the cell itself is an input
    const tagName = await inputCell.evaluate(el => el.tagName.toLowerCase());
    if (tagName === 'input') {
        await inputCell.fill('admin');
    } else {
        await inputCell.locator('input').fill('admin');
    }

    // 4. Assert
    await expect(page.locator('input[name="u"]')).toHaveValue('admin');
  });

  test('useMenu: Overriding Logic for Div-based Menu', async ({ page }) => {
    // 1. Arrange: A modern "Div Soup" menu (no ul/li)
    await page.setContent(`
      <nav id="modern-menu">
        <div role="button">Home</div>
        <div role="button">Settings</div>
        <div role="button">Logout</div>
      </nav>
    `);

    // 2. Initialize with Override
    const menu = useMenu(page.locator('#modern-menu'), {
      rowSelector: 'div[role="button"]' // Override default 'li'
    });

    // 3. Act: Find "Settings"
    const settings = await menu.getByRow({ Item: 'Settings' });
    
    // 4. Assert
    await expect(settings).toBeVisible();
    await expect(settings).toHaveText('Settings');
  });

});