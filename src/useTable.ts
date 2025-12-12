import { Locator, Page, expect } from '@playwright/test';
import { TableConfig, TableContext, Selector } from './types';

export const useTable = (rootLocator: Locator, configOptions: TableConfig = {}) => {
    const config: Required<TableConfig> = {
        rowSelector: "tbody tr",
        headerSelector: "th",
        cellSelector: "td",
        pagination: undefined as any,
        maxPages: 1,
        columnNames: [], 
        ...configOptions,
    };

    const resolve = (item: Selector, parent: Locator | Page): Locator => {
        if (typeof item === 'string') return parent.locator(item);
        if (typeof item === 'function') return item(parent);
        throw new Error("Cannot resolve a null selector. Ensure your config defines selectors correctly.");
    };

    let _headerMap: Map<string, number> | null = null;

    const _getMap = async () => {
        if (_headerMap) return _headerMap;

        // 1. Scrape DOM (Only if headerSelector is NOT null)
        let texts: string[] = [];
        if (config.headerSelector) {
            const headerLoc = resolve(config.headerSelector, rootLocator);
            try {
                await headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
                texts = await headerLoc.allInnerTexts();
            } catch (e) { /* Ignore hydration/empty/timeout */ }
        }

        // 2. Merge Scraped Data with Config Overrides
        _headerMap = new Map();
        const overrides = config.columnNames || [];
        const colCount = Math.max(texts.length, overrides.length);

        for (let i = 0; i < colCount; i++) {
            const scrapedText = (texts[i] || "").trim() || `__col_${i}`;
            const overrideText = overrides[i];
            const finalName = (overrideText !== undefined) ? overrideText : scrapedText;
            _headerMap.set(finalName, i);
        }
        return _headerMap;
    };

    const _findRowLocator = async (filters: Record<string, string | RegExp | number>, options: { exact?: boolean, maxPages?: number } = {}) => {
        const map = await _getMap();
        const page = rootLocator.page();
        const effectiveMaxPages = options.maxPages ?? config.maxPages;
        let currentPage = 1;

        while (true) {
            if (!config.rowSelector) throw new Error("rowSelector cannot be null");
            let rowLocator = resolve(config.rowSelector, rootLocator);

            for (const [colName, value] of Object.entries(filters)) {
                const colIndex = map.get(colName);
                if (colIndex === undefined) throw new Error(`Column '${colName}' not found. Available: ${Array.from(map.keys())}`);

                const exact = options.exact || false;
                const filterVal = typeof value === 'number' ? String(value) : value;

                // Case 1: No Cell Selector (Menu) - Filter the Row Itself
                if (!config.cellSelector) {
                     if (exact) {
                         rowLocator = rowLocator.filter({ hasText: new RegExp(`^${escapeRegExp(String(filterVal))}$`) });
                     } else {
                         rowLocator = rowLocator.filter({ hasText: filterVal });
                     }
                } 
                // Case 2: String Cell Selector - Standard Table Logic (Restored)
                else if (typeof config.cellSelector === 'string') {
                    // RESTORED: This logic worked for standard tables. 
                    // We resolve against the PAGE to create a generic locator template.
                    // Playwright handles the relative filtering correctly for standard tables.
                    const cellTemplate = resolve(config.cellSelector, page);
                    
                    rowLocator = rowLocator.filter({
                        has: cellTemplate.nth(colIndex).getByText(filterVal, { exact }),
                    });
                }
                // Case 3: Function Cell Selector - Forms (Iterative Fallback)
                else {
                    const count = await rowLocator.count();
                    let matchFound = false;
                    
                    for (let i = 0; i < count; i++) {
                        const specificRow = rowLocator.nth(i);
                        // Resolve cell relative to this specific row
                        const specificCell = config.cellSelector(specificRow).nth(colIndex);
                        
                        if (await specificCell.getByText(filterVal, { exact }).count() > 0) {
                            if (matchFound) {
                                throw new Error(`Strict Mode Violation: Found multiple rows matching ${JSON.stringify(filters)}.`);
                            }
                            rowLocator = specificRow; 
                            matchFound = true;
                            // Break inner loop to proceed to next filter or return
                            break; 
                        }
                    }
                    
                    if (!matchFound) {
                        // Return empty locator to fail gracefully
                        return resolve(config.rowSelector as Selector, rootLocator).filter({ hasText: "NON_EXISTENT_ROW_" + Date.now() });
                    }
                }
            }

            const count = await rowLocator.count();
            if (count > 1) throw new Error(`Strict Mode Violation: Found ${count} rows matching ${JSON.stringify(filters)}.`);
            if (count === 1) return rowLocator.first();

            // --- PAGINATION ---
            if (config.pagination && currentPage < effectiveMaxPages) {
                const context: TableContext = { root: rootLocator, config: config, page: page, resolve: resolve };
                if (await config.pagination(context)) {
                    currentPage++;
                    continue;
                }
            }
            return null;
        }
    };

    return {
        getHeaders: async () => Array.from((await _getMap()).keys()),

        getByRow: async (filters: Record<string, string | RegExp | number>, options: { exact?: boolean, maxPages?: number } = {}) => {
            const row = await _findRowLocator(filters, options);
            if (!row) return resolve(config.rowSelector as Selector, rootLocator).filter({ hasText: "NON_EXISTENT_ROW_SENTINEL_" + Date.now() });
            return row;
        },

        getByCell: async (rowFilters: Record<string, string | RegExp | number>, targetColumn: string) => {
            const row = await _findRowLocator(rowFilters);
            if (!row) throw new Error(`Row not found: ${JSON.stringify(rowFilters)}`);
            
            // Guard: getByCell makes no sense for Menus (no cells)
            if (!config.cellSelector) {
                throw new Error("getByCell is not supported when 'cellSelector' is null (e.g. Menus). Use getByRow instead.");
            }

            const map = await _getMap();
            const colIndex = map.get(targetColumn);
            if (colIndex === undefined) throw new Error(`Column '${targetColumn}' not found.`);

            if (typeof config.cellSelector === 'string') {
                return row.locator(config.cellSelector).nth(colIndex);
            } else {
                return resolve(config.cellSelector, row).nth(colIndex);
            }
        },

        getRows: async () => {
            const map = await _getMap();
            const rowLocator = resolve(config.rowSelector, rootLocator);
            const rowCount = await rowLocator.count();
            const results: Record<string, string>[] = [];

            for (let i = 0; i < rowCount; i++) {
                const row = rowLocator.nth(i);
                let cellTexts: string[] = [];
                
                if (!config.cellSelector) {
                   cellTexts = [await row.innerText()];
                } else if (typeof config.cellSelector === 'string') {
                    // For string selectors, we query all matching cells in the row
                    cellTexts = await row.locator(config.cellSelector).allInnerTexts();
                } else {
                    // For function selectors, we resolve against the row
                    cellTexts = await resolve(config.cellSelector, row).allInnerTexts();
                }
                
                const rowData: Record<string, string> = {};
                for (const [colName, colIdx] of map.entries()) {
                    rowData[colName] = (cellTexts[colIdx] || "").trim();
                }
                results.push(rowData);
            }
            return results;
        },

        getRowAsJSON: async (filters: Record<string, string | RegExp | number>) => {
            const row = await _findRowLocator(filters);
            if (!row) throw new Error(`Row not found: ${JSON.stringify(filters)}`);

            let cellTexts: string[] = [];
            if (!config.cellSelector) {
                 cellTexts = [await row.innerText()];
            } else if (typeof config.cellSelector === 'string') {
                cellTexts = await row.locator(config.cellSelector).allInnerTexts();
            } else {
                cellTexts = await resolve(config.cellSelector, row).allInnerTexts();
            }

            const map = await _getMap();
            const result: Record<string, string> = {};
            for (const [colName, colIndex] of map.entries()) {
                result[colName] = (cellTexts[colIndex] || "").trim();
            }
            return result;
        },

        setColumnName: async (colIndex: number, newNameOrFn: string | ((current: string) => string)) => {
            const map = await _getMap();
            let oldName = "";
            for (const [name, idx] of map.entries()) {
                if (idx === colIndex) { oldName = name; break; }
            }
            if (!oldName) oldName = `__col_${colIndex}`;
            const newName = typeof newNameOrFn === 'function' ? newNameOrFn(oldName) : newNameOrFn;
            if (map.has(oldName)) map.delete(oldName);
            map.set(newName, colIndex);
        },

        generateConfigPrompt: async () => {
            const html = await rootLocator.evaluate((el) => el.outerHTML);
            console.log(`\n=== CONFIG PROMPT ===\nI have this HTML:\n\`\`\`html\n${html}\n\`\`\`\nGenerate a 'useTable' config for it.`);
        },
        generateStrategyPrompt: async () => {
            const container = rootLocator.locator('xpath=..'); 
            const html = await container.evaluate((el) => el.outerHTML);
            console.log(`\n=== STRATEGY PROMPT ===\nI have this Container HTML:\n\`\`\`html\n${html.substring(0, 2000)}\n\`\`\`\nWrite a pagination strategy.`);
        }
    };
};

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}