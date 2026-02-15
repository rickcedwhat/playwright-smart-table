import { Locator, Page } from "@playwright/test";
import { FinalTableConfig, FilterValue } from "./types";
export declare class FilterEngine {
    private config;
    private resolve;
    constructor(config: FinalTableConfig, resolve: (selector: any, parent: Locator | Page) => Locator);
    /**
     * Applies filters to a set of rows.
     */
    applyFilters(baseRows: Locator, filters: Record<string, FilterValue>, map: Map<string, number>, exact: boolean, page: Page): Locator;
}
