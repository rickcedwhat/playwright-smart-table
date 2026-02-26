import { test, expect, chromium } from '@playwright/test';

(async () => {
    console.log("Starting server/browser test...");
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        await page.goto('http://localhost:3000/virtualized');

        const config = {
            rowCount: 20,
            columnCount: 100,
            virtualizeColumns: true,
            defaults: { tableInitDelay: 0, rowDelay: 0, generator: "simple" }
        };
        await page.locator('textarea').click();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.press('Backspace');
        await page.locator('textarea').fill(JSON.stringify(config, null, 2));
        await page.getByRole('button', { name: 'Apply & Reload Table' }).click();
        await page.waitForTimeout(1000);

        const scroller = page.locator('[data-testid="virtuoso-scroller"]');

        let finalHeaders = new Array(100).fill('');
        for (let i = 0; i < 50; i++) {
            const texts = await page.locator('.header [role="columnheader"]').allInnerTexts();
            let foundNew = false;
            for (let j = 0; j < texts.length; j++) {
                if (texts[j].trim() && finalHeaders[j] === '') {
                    finalHeaders[j] = texts[j].trim();
                    foundNew = true;
                }
            }
            if (!foundNew && i > 0) break;
            await scroller.evaluate((s, i) => s.scrollLeft += 1000);
            await page.waitForTimeout(50);
        }
        console.log("Mapped exactly", finalHeaders.filter(Boolean).length, "headers.");

        const row = page.locator('.virtual-row').first();
        const cell = row.locator('[role="cell"]').nth(99);
        const html = await cell.evaluate(e => e.outerHTML);
        console.log("Cell 99 HTML:", html);

        const count = await row.locator('[role="cell"]').filter({ hasText: /Data for Row 1 Column 100/i }).count();
        console.log("Cells matching text:", count);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
