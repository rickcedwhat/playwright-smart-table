import { StrategyContext, Selector } from '../types';

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
        const headerLoc = resolve(config.headerSelector as Selector, root);
        try {
            // Wait for at least one header to be visible
            await headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
        } catch (e) {
            // Ignore hydration/timeout issues, return what we have
        }

        const texts = await headerLoc.allInnerTexts();
        return texts.map(t => t.trim());
    }
};
