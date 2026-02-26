import { Locator } from '@playwright/test';
export declare class ElementTracker {
    readonly id: string;
    constructor(prefix?: string);
    /**
     * Finds the indices of newly seen elements in the browser, storing their text signature
     * in a WeakMap. This gracefully handles both append-only DOMs (by identity) and
     * virtualized DOMs (by text signature if nodes are recycled).
     */
    getUnseenIndices(locators: Locator): Promise<number[]>;
    /**
     * Cleans up the tracking map from the browser window object.
     */
    cleanup(page: any): Promise<void>;
}
