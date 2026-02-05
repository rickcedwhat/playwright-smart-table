import { Page } from '@playwright/test';
/**
 * Internal helper to wait for a condition to be met.
 * Replaces the dependency on 'expect(...).toPass()' to ensure compatibility
 * with environments where 'expect' is not globally available.
 */
export declare const waitForCondition: (predicate: () => Promise<boolean>, timeout: number, page: Page) => Promise<boolean>;
