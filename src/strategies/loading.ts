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
         * Checks if the headers are stable (count and text) for a specified duration.
         * @param duration Duration in ms for headers to remain unchanged to be considered stable (default: 200).
         */
        stable: (duration: number = 200) => async (context: TableContext): Promise<boolean> => {
            const { config, resolve, root } = context;
            const getHeaderTexts = async () => {
                const headers = await resolve(config.headerSelector as Selector, root).all();
                return Promise.all(headers.map(h => h.innerText()));
            };

            const initial = await getHeaderTexts();
            // Wait for duration
            await context.page.waitForTimeout(duration);
            const current = await getHeaderTexts();

            if (initial.length !== current.length) return true; // Count changed, still loading
            for (let i = 0; i < initial.length; i++) {
                if (initial[i] !== current[i]) return true; // Content changed, still loading
            }
            return false; // Stable
        },

        /**
         * Assume headers are never loading (immediate snapshot).
         */
        never: async () => false
    }
};
