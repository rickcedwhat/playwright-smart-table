import { Locator } from '@playwright/test';

export class ElementTracker {
    public readonly id: string;

    constructor(prefix = 'tracker') {
        this.id = `__smartTable_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Returns indices of newly seen or recycled elements without marking them as seen.
     * Call {@link commitIndices} to persist the subset you intend to process.
     */
    public async peekUnseenIndices(locators: Locator): Promise<number[]> {
        return await locators.evaluateAll((elements, trackerId) => {
            const win = window as any;
            if (!win[trackerId]) {
                win[trackerId] = new WeakMap<Element, string>();
            }
            const seenMap = win[trackerId] as WeakMap<Element, string>;
            const newIndices: number[] = [];

            elements.forEach((el, index) => {
                const signature = el.textContent || '';
                if (seenMap.get(el) !== signature) {
                    newIndices.push(index);
                }
            });

            return newIndices;
        }, this.id);
    }

    /**
     * Marks the given indices as seen. Only call this for the subset you intend to process;
     * uncommitted indices will be returned again by the next peek/getUnseenIndices call.
     */
    public async commitIndices(locators: Locator, indices: number[]): Promise<void> {
        await locators.evaluateAll((elements, [trackerId, indicesToCommit]) => {
            const win = window as any;
            if (!win[trackerId]) {
                win[trackerId] = new WeakMap<Element, string>();
            }
            const seenMap = win[trackerId] as WeakMap<Element, string>;
            for (const index of indicesToCommit) {
                const el = elements[index];
                if (el) seenMap.set(el, el.textContent || '');
            }
        }, [this.id, indices] as [string, number[]]);
    }

    /**
     * Finds the indices of newly seen elements in the browser, storing their text signature
     * in a WeakMap. This gracefully handles both append-only DOMs (by identity) and
     * virtualized DOMs (by text signature if nodes are recycled).
     */
    public async getUnseenIndices(locators: Locator): Promise<number[]> {
        const indices = await this.peekUnseenIndices(locators);
        await this.commitIndices(locators, indices);
        return indices;
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
