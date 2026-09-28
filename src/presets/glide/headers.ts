import { StrategyContext } from '../../types';
import { scrollAndCollectHeaders } from '../../utils/headerScroll';

/**
 * Glide header discovery. Same scroll loop as `HeaderStrategies.horizontalScroll`, but the
 * `.dvn-scroller` is a sibling of the canvas root rather than an ancestor/descendant, so the
 * lookup falls back to a document-wide search.
 */
export const scrollRightHeader = async (context: StrategyContext, options?: { limit?: number, selector?: string, scrollAmount?: number }): Promise<string[]> => {
    const findScroller = () => context.root.evaluateHandle((el, selector) => {
        if (selector && el.matches(selector)) return el;
        const effectiveSelector = selector || '.dvn-scroller';
        return el.closest(effectiveSelector) ?? document.querySelector(effectiveSelector);
    }, options?.selector);

    return scrollAndCollectHeaders(context, findScroller, {
        limit: options?.limit,
        scrollAmount: options?.scrollAmount,
        notFoundMessage: 'HeaderStrategies.scrollRight: Could not find scroller. Returning visible headers.',
    });
};
