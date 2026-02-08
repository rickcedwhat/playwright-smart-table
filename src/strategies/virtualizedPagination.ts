import { PaginationStrategy, TableContext } from '../types';

/**
 * Strategies for handling virtualized pagination where:
 * 1. The total row count might not change (DOM recycling).
 * 2. We need to check for *new content* appearing to confirm pagination success.
 */
export const virtualizedInfiniteScroll = (options: {
    /** Selector for the scrollable container. Defaults to table root. */
    scrollTarget?: string;
    /** Amount to scroll in pixels. Default 500. */
    scrollAmount?: number;
    /** Timeout to wait for content stability. Default 500ms. */
    stabilityTimeout?: number;
    /** Max retries to detect content change. Default 3. */
    retries?: number;
    /** force use of JS scrollTop property instead of mouse wheel. Default: false */
    useJsScroll?: boolean;
} = {}): PaginationStrategy => {
    return async ({ root, config, page, resolve }: TableContext) => {
        const scrollTargetLocator = options.scrollTarget
            ? (typeof options.scrollTarget === 'string' ? root.locator(options.scrollTarget) : resolve(options.scrollTarget, root))
            : root;

        // Resolve the rows locator
        const rows = resolve(config.rowSelector, root);

        // Helper to get a "fingerprint" of the current visible content
        const getFingerprint = async () => {
            // We grab all inner texts of the rows as a crude but effective hash
            // Virtualization replaces row content, so this ensures we detect changes
            const allText = await rows.allInnerTexts();
            return allText.join('|');
        };

        const beforeFingerprint = await getFingerprint();
        const startScrollTop = await scrollTargetLocator.evaluate((el) => el.scrollTop).catch(() => 0);

        // --- Perform Scroll ---
        const amount = options.scrollAmount ?? 500;
        const box = await scrollTargetLocator.boundingBox();

        if (options.useJsScroll || !box) {
            // Fast path: JS Scroll or fallback if no bounding box
            await scrollTargetLocator.evaluate((el: HTMLElement, y: number) => {
                el.scrollTop += y;
            }, amount);
        } else {
            // Realistic path: Mouse Wheel
            // Move to center of the scroll container
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.wheel(0, amount);
        }

        // Wait for the virtual list to settle/render new items
        await page.waitForTimeout(options.stabilityTimeout ?? 500);

        // --- Verification ---
        const endScrollTop = await scrollTargetLocator.evaluate((el) => el.scrollTop).catch(() => 0);

        // If we didn't physically scroll (hit bottom or element not scrollable), we're done.
        // Note: Some virtual lists allow overscroll, so this check isn't 100% foolproof but helpful.
        if (endScrollTop <= startScrollTop) {
            // Double check content just in case
            const afterCheck = await getFingerprint();
            const changed = afterCheck !== beforeFingerprint;
            if (changed) return true;
            return false;
        }

        // Retry loop to allow for async loading/rendering of new rows
        let retries = options.retries ?? 3;
        while (retries > 0) {
            const afterFingerprint = await getFingerprint();
            if (afterFingerprint !== beforeFingerprint) {
                return true; // Content changed!
            }
            await page.waitForTimeout(200);
            retries--;
        }

        return false; // No change in content detected
    };
};

export const VirtualizedPaginationStrategies = {
    virtualInfiniteScroll: virtualizedInfiniteScroll
};
