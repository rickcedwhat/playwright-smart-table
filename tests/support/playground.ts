import { expect, type Page } from '@playwright/test';

/** Each completed table (re)load bumps `data-table-key` and clears `data-table-loading`. */
const tableCard = (page: Page) => page.getByTestId('table-card');

async function waitForTableLoad(page: Page, key: number): Promise<void> {
    await expect(tableCard(page)).toHaveAttribute('data-table-key', String(key));
    await expect(tableCard(page)).toHaveAttribute('data-table-loading', 'false');
}

/**
 * Opens the virtualized playground and waits for its initial table load. Otherwise the
 * page-load reload timer can fire after `setPlaygroundConfig` and remount the table mid-test.
 */
export async function openVirtualizedPlayground(page: Page): Promise<void> {
    await page.goto('http://localhost:3000/virtualized');
    await expect(page.getByRole('heading', { name: 'Virtualized Table Scenario' })).toBeVisible();
    await waitForTableLoad(page, 1);
}

/** Applies a playground config and waits until the table has remounted with it. */
export async function setPlaygroundConfig(page: Page, config: unknown): Promise<void> {
    const key = Number(await tableCard(page).getAttribute('data-table-key'));
    const json = JSON.stringify(config, null, 2);
    const textarea = page.locator('textarea');
    await textarea.fill(json);
    // React's controlled textarea must flush onChange before Apply reads the config.
    await expect(textarea).toHaveValue(json);
    await page.getByRole('button', { name: 'Apply & Reload Table' }).click();
    await waitForTableLoad(page, key + 1);
}
