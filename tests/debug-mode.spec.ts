import { test, expect, Page } from '@playwright/test';
import { useTable } from '../src/index';

// Message content and getDebugDelay resolution are unit-tested in tests/unit/debugUtils.coverage.test.ts;
// these check that debug.slow actually delays real table calls.

/** Shorter delays in CI so debug.slow tests stay valid but do not dominate runtime. */
const isCI = !!process.env.CI;
const slow = {
    uniformMs: isCI ? 80 : 500,
    granularDefaultMs: isCI ? 120 : 800,
    granularFindRowMs: isCI ? 100 : 600,
};

function minElapsedForDelay(ms: number): number {
    return Math.max(15, Math.floor(ms * 0.85));
}

async function setupTable(page: Page) {
    await page.setContent(`
        <table id="t">
            <thead><tr><th>Name</th><th>Office</th></tr></thead>
            <tbody>
                <tr><td>Airi Satou</td><td>Tokyo</td></tr>
                <tr><td>Bradley Greer</td><td>London</td></tr>
            </tbody>
        </table>
    `);
    return page.locator('#t');
}

test.describe('Debug Mode', () => {
    test('a single debug.slow value delays init()', async ({ page }) => {
        const root = await setupTable(page);
        const table = useTable(root, { debug: { slow: slow.uniformMs, logLevel: 'info' } });

        const start = Date.now();
        await table.init();
        const elapsed = Date.now() - start;

        expect(elapsed).toBeGreaterThanOrEqual(minElapsedForDelay(slow.uniformMs));
    });

    test('per-action debug.slow delays init() by default and findRow() by its own value', async ({ page }) => {
        const root = await setupTable(page);
        const table = useTable(root, {
            debug: {
                slow: { default: slow.granularDefaultMs, findRow: slow.granularFindRowMs },
                logLevel: 'info',
            },
        });

        const initStart = Date.now();
        await table.init();
        const initElapsed = Date.now() - initStart;

        const findStart = Date.now();
        const row = await table.findRow({ Name: 'Airi Satou' });
        const findElapsed = Date.now() - findStart;

        expect(initElapsed).toBeGreaterThanOrEqual(minElapsedForDelay(slow.granularDefaultMs));
        expect(findElapsed).toBeGreaterThanOrEqual(minElapsedForDelay(slow.granularFindRowMs));
        expect(row.wasFound()).toBe(true);
    });
});
