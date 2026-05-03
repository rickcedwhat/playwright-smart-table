import { SmartRow, TableContext, Selector } from '../types';

/**
 * Strategies for detecting loading states.
 * Return `true` if the item is loading/busy, `false` if it is ready.
 */
export const LoadingStrategies = {
    /**
     * Strategies for detecting if the entire table is loading.
     */
    Table: {
        /**
         * Checks if a global spinner or loading overlay is visible.
         * @param selector Selector for the loading indicator (e.g. '.loading-spinner')
         */
        hasSpinner: (selector: string = '.loading-spinner') => async ({ root }: TableContext): Promise<boolean> => {
            // Check if spinner exists and is visible within the table wrapper or page
            const spinner = root.locator(selector).first();
            try {
                return await spinner.isVisible();
            } catch {
                return false;
            }
        },

        /**
         * Custom function to determine table loading state.
         */
        custom: (fn: (context: TableContext) => Promise<boolean>) => fn,

        /**
         * Assume table is never loading (default).
         */
        never: async () => false
    },

    /**
     * Strategies for detecting if a specific row is loading (e.g. Skeleton).
     */
    Row: {
        /**
         * Checks if the row contains a specific class indicating it's a skeleton/loading row.
         * @param className Class name acting as the loading indicator (default: 'skeleton')
         */
        hasClass: (className: string = 'skeleton') => async (row: SmartRow): Promise<boolean> => {
            const cls = await row.getAttribute('class');
            return cls ? cls.includes(className) : false;
        },

        /**
         * Checks if the row's text content matches a "Loading..." string or regex.
         */
        hasText: (text: string | RegExp = 'Loading...') => async (row: SmartRow): Promise<boolean> => {
            const content = await row.innerText();
            if (typeof text === 'string') return content.includes(text);
            return text.test(content);
        },

        /**
         * Checks if the row has any cell with empty/falsy content (if strict).
         * Useful if rows render with empty cells before populating.
         */
        hasEmptyCells: () => async (row: SmartRow): Promise<boolean> => {
            // Logic: Get all cells, check if any are empty.
            // Note: This might be expensive if done for every row check.
            // Simplified: check if InnerText is empty or very short?
            const text = await row.innerText();
            return !text.trim();
        },

        /**
         * Assume row is never loading (default).
         */
        never: async () => false
    },
    /**
     * Strategies for detecting if headers are loading/stable.
     */
    Headers: {
        /**
         * Waits until the header signature (count + text) remains unchanged for `duration` ms.
         *
         * The default single-shot check (read → wait → read) is fine for most grids.
         * For slow or virtualized grids that churn headers for several seconds, supply
         * `pollMs` and optionally `timeoutMs` to poll in a loop until stable.
         *
         * @param duration  Stable window in ms — headers must not change for this long (default: 200).
         * @param options.pollMs     How often to re-check while waiting (default: same as `duration`, i.e. single-shot).
         * @param options.timeoutMs  Hard deadline in ms; throws if stability is never reached (default: no hard timeout).
         */
        stable: (duration: number = 200, options: { pollMs?: number; timeoutMs?: number } = {}) =>
            async (context: TableContext): Promise<boolean> => {
                const { config, resolve, root } = context;
                const { pollMs, timeoutMs } = options;

                const getSignature = async (): Promise<string> => {
                    const headers = await resolve(config.headerSelector as Selector, root).all();
                    const texts = await Promise.all(headers.map(h => h.innerText()));
                    return texts.join('\x00');
                };

                // Single-shot path (original behaviour): no polling requested
                if (pollMs === undefined) {
                    const initial = await getSignature();
                    await context.page.waitForTimeout(duration);
                    const current = await getSignature();
                    return initial !== current; // true = still loading
                }

                // Polling path
                const deadline = timeoutMs !== undefined ? Date.now() + timeoutMs : Infinity;
                let stableStart: number | null = null;
                let lastSig = await getSignature();

                while (true) {
                    await context.page.waitForTimeout(pollMs);

                    if (Date.now() > deadline) {
                        throw new Error(
                            `Headers.stable: headers did not stabilise within ${timeoutMs}ms`
                        );
                    }

                    const sig = await getSignature();
                    if (sig !== lastSig) {
                        lastSig = sig;
                        stableStart = null;
                        continue;
                    }

                    if (stableStart === null) {
                        stableStart = Date.now();
                        continue;
                    }

                    if (Date.now() - stableStart >= duration) {
                        return false; // Stable — not loading
                    }
                }
            },

        /**
         * Assume headers are never loading (immediate snapshot).
         */
        never: async () => false
    }
};
