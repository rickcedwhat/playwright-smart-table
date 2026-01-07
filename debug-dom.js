const { chromium, expect } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://glideapps.github.io/glide-data-grid/?path=/story/glide-data-grid-dataeditor-demos--add-data');
    const frame = page.frameLocator('#storybook-preview-iframe');
    const row = frame.locator('table[role="grid"] tbody tr').first();
    try {
        // Wait for attached, not visible (since it's an accessibility fallback)
        await row.waitFor({ state: 'attached', timeout: 5000 });
        const html = await row.evaluate(el => el.innerHTML);
        console.log("Row HTML:");
        console.log(html);

        // Also print row count and cell count
        const cells = await row.locator('td').count();
        console.log(`Cell count: ${cells}`);
    } catch (e) {
        console.error("Failed to find row:", e);
    }
    await browser.close();
})();
