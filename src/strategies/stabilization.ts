import { TableContext } from '../types';

/**
 * A Stabilization Strategy determines when a table has "settled" after an action.
 * It wraps the action to capture state before and after.
 */
export type StabilizationStrategy = (context: TableContext, action: () => Promise<void>) => Promise<boolean>;

export const StabilizationStrategies = {
    /**
     * Waits for the visible text of the table rows to change.
     */
    contentChanged: (options: { scope?: 'all' | 'first', timeout?: number } = {}): StabilizationStrategy => {
        return async ({ root, config, resolve, page }, action) => {
            const rows = resolve(config.rowSelector, root);
            const timeout = options.timeout ?? 5000;
            const scope = options.scope ?? 'all';

            // Helper to get fingerprint
            const getFingerprint = async () => {
                if (scope === 'first') {
                    return await rows.first().innerText().catch(() => '');
                }
                const allText = await rows.allInnerTexts();
                return allText.join('|');
            };

            // 1. Capture Before
            const beforeFingerprint = await getFingerprint();

            // 2. Perform Action
            await action();

            // 3. Wait for Change
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                const afterFingerprint = await getFingerprint();
                if (afterFingerprint !== beforeFingerprint) {
                    return true;
                }
                await page.waitForTimeout(100);
            }

            return false;
        };
    },

    /**
     * Waits for the total number of rows to strictly increase.
     */
    rowCountIncreased: (options: { timeout?: number } = {}): StabilizationStrategy => {
        return async ({ root, config, resolve, page }, action) => {
            const rows = resolve(config.rowSelector, root);
            const timeout = options.timeout ?? 5000;

            const beforeCount = await rows.count();

            await action();

            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                const afterCount = await rows.count();
                if (afterCount > beforeCount) {
                    return true;
                }
                await page.waitForTimeout(100);
            }

            return false;
        };
    },


    /**
     * Waits for a specific network condition or spinner to disappear.
     * Useful for tables that have explicit loading states but might not change content immediately.
     */
    networkIdle: (options: { spinnerSelector?: string, timeout?: number } = {}): StabilizationStrategy => {
        return async ({ root, page, resolve }) => {
            const timeout = options.timeout ?? 5000;
            if (options.spinnerSelector) {
                const spinner = resolve(options.spinnerSelector, root);
                try {
                    await spinner.waitFor({ state: 'detached', timeout });
                    return true;
                } catch {
                    return false;
                }
            }
            // Fallback to simple wait if no selector
            await page.waitForTimeout(500);
            return true;
        }
    }
};
