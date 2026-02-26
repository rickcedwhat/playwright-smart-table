import { Locator } from '@playwright/test';

export class ElementTracker {
    public readonly id: string;

    constructor(prefix = 'tracker') {
        this.id = `__smartTable_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Finds the indices of newly seen elements in the browser, storing their text signature
     * in a WeakMap. This gracefully handles both append-only DOMs (by identity) and 
     * virtualized DOMs (by text signature if nodes are recycled).
     */
    public async getUnseenIndices(locators: Locator): Promise<number[]> {
        return await locators.evaluateAll((elements, trackerId) => {
            const win = window as any;
            if (!win[trackerId]) {
                win[trackerId] = new WeakMap<Element, string>();
            }
            const seenMap = win[trackerId] as WeakMap<Element, string>;
            const newIndices: number[] = [];

            elements.forEach((el, index) => {
                // Determine a lightweight signature for the row (textContent strips HTML, fast)
                const signature = el.textContent || '';

                // If it's a new element, OR a recycled element with new data
                if (seenMap.get(el) !== signature) {
                    seenMap.set(el, signature);
                    newIndices.push(index);
                }
            });

            return newIndices;
        }, this.id);
    }

    /**
     * Cleans up the tracking map from the browser window object.
     */
    public async cleanup(page: any): Promise<void> {
        try {
            await page.evaluate((trackerId: string) => {
                delete (window as any)[trackerId];
            }, this.id);
        } catch (e) {
            // Ignore context destroyed errors during cleanup
        }
    }
}
