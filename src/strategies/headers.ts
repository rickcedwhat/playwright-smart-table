// fallow-ignore-file circular-dependency
import type { StrategyContext } from '../types';
import { logDebug } from '../utils/debugUtils';
import { readVisibleHeaders, scrollAndCollectHeaders } from '../utils/headerScroll';

/**
 * Defines the contract for a header retrieval strategy.
 * Returns a list of unique header names found in the table.
 */
export type HeaderStrategy = (context: StrategyContext) => Promise<string[]>;

export const HeaderStrategies = {
    /**
     * Default strategy: Returns only the headers currently visible in the DOM.
     * This is fast but won't find virtualized columns off-screen.
     */
    visible: async ({ config, resolve, root }: StrategyContext): Promise<string[]> => {
        const headerLoc = resolve(config.headerSelector, root);
        try {
            // Wait for at least one header to be visible
            await headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
        } catch (e) {
            // Ignore hydration/timeout issues, return what we have
        }

        const texts = await headerLoc.allInnerTexts();
        return texts.map(t => t.trim());
    },

    /**
     * Physically scrolls the table horizontally to force virtualized columns to mount,
     * collecting their names along the way.
     *
     * **Requires `selector`** — the CSS selector for the horizontal scroll container
     * (e.g. `.dvn-scroller` for Glide, `.rdg-viewport` for RDG). Framework class names
     * belong in presets / your config, not in this generic factory. Without `selector`,
     * only currently visible headers are returned (no scrolling).
     */
    horizontalScroll: (options?: { limit?: number, selector?: string, scrollAmount?: number }): HeaderStrategy => {
        return async (context: StrategyContext): Promise<string[]> => {
            const selector = options?.selector;
            if (!selector) {
                logDebug(
                    context.config,
                    'info',
                    'HeaderStrategies.horizontalScroll: no selector provided — returning visible headers only. Pass { selector } for the scroll container (e.g. ".dvn-scroller").',
                );
                return readVisibleHeaders(context);
            }

            // Self, then ancestor, then descendant — scoped to the table, never document-wide.
            const findScroller = () => context.root.evaluateHandle((el, sel) =>
                el.matches(sel) ? el : el.closest(sel) ?? el.querySelector(sel), selector);

            return scrollAndCollectHeaders(context, findScroller, {
                limit: options?.limit,
                scrollAmount: options?.scrollAmount,
                notFoundMessage: `HeaderStrategies.horizontalScroll: Could not find scroller matching "${selector}". Returning visible headers.`,
            });
        };
    }
};
