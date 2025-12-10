// src/useTable.ts
import { Locator, Page, expect } from '@playwright/test';
import { TableConfig, TableContext, Selector } from './types';

export const useTable = (rootLocator: Locator, configOptions: TableConfig = {}) => {
    const config: Required<TableConfig> = {
        rowSelector: "tbody tr",
        headerSelector: "th",
        cellSelector: "td",
        pagination: undefined as any,
        maxPages: 1,
        ...configOptions,
    };

    // ✅ UPDATE: Accept Locator OR Page (to match your work logic)
    const resolve = (item: Selector, parent: Locator | Page): Locator => {
        if (typeof item === 'string') return parent.locator(item);
        if (typeof item === 'function') return item(parent);
        return item;
    };

    let _headerMap: Map<string, number> | null = null;

    const _getMap = async () => {
        if (_headerMap) return _headerMap;
        // Headers are still resolved relative to the table root (safer)
        const headerLoc = resolve(config.headerSelector, rootLocator);
        try {
            await headerLoc.first().waitFor({ state: 'visible', timeout: 3000 });
        } catch (e) { /* Ignore hydration */ }

        const texts = await headerLoc.allInnerTexts();
        _headerMap = new Map(texts.map((t, i) => [t.trim() || `__col_${i}`, i]));
        return _headerMap;
    };

    const _findRowLocator = async (filters: Record<string, string | RegExp | number>, options: { exact?: boolean, maxPages?: number } = {}) => {
        const map = await _getMap();
        const page = rootLocator.page();
        const effectiveMaxPages = options.maxPages ?? config.maxPages;
        let currentPage = 1;

        while (true) {
            // 1. Row Locator uses ROOT (Matches your snippet)
            let rowLocator = resolve(config.rowSelector, rootLocator);

            for (const [colName, value] of Object.entries(filters)) {
                const colIndex = map.get(colName);
                if (colIndex === undefined) throw new Error(`Column '${colName}' not found.`);

                const exact = options.exact || false;
                const filterVal = typeof value === 'number' ? String(value) : value;

                // ✅ MATCHING YOUR WORK LOGIC EXACTLY
                // 2. Cell Template uses PAGE (Matches your snippet)
                const cellTemplate = resolve(config.cellSelector, page);

                // 3. Filter using .nth(colIndex)
                rowLocator = rowLocator.filter({
                    has: cellTemplate.nth(colIndex).getByText(filterVal, { exact }),
                });
            }

            const count = await rowLocator.count();
            if (count > 1) {
                throw new Error(`Strict Mode Violation: Found ${count} rows matching ${JSON.stringify(filters)}.`);
            }

            if (count === 1) return rowLocator.first();

            // --- PAGINATION LOGIC ---
            if (config.pagination && currentPage < effectiveMaxPages) {
                const context: TableContext = {
                    root: rootLocator,
                    config: config,
                    page: page,
                    resolve: resolve
                };

                const didLoadMore = await config.pagination(context);
                if (didLoadMore) {
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
            if (!row) return resolve(config.rowSelector, rootLocator).filter({ hasText: "NON_EXISTENT_ROW_SENTINEL_" + Date.now() });
            return row;
        },

        getByCell: async (rowFilters: Record<string, string | RegExp | number>, targetColumn: string) => {
            const row = await _findRowLocator(rowFilters);
            if (!row) throw new Error(`Row not found: ${JSON.stringify(rowFilters)}`);

            const map = await _getMap();
            const colIndex = map.get(targetColumn);
            if (colIndex === undefined) throw new Error(`Column '${targetColumn}' not found.`);

            // Return the specific cell
            // We scope this to the found ROW to ensure we get the right cell
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
                let cells: Locator;
                if (typeof config.cellSelector === 'string') {
                    cells = row.locator(config.cellSelector);
                } else {
                    cells = resolve(config.cellSelector, row);
                }
                const cellTexts = await cells.allInnerTexts();
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

            let cells: Locator;
            if (typeof config.cellSelector === 'string') {
                cells = row.locator(config.cellSelector);
            } else {
                cells = resolve(config.cellSelector, row);
            }
            const cellTexts = await cells.allInnerTexts();
            const map = await _getMap();
            const result: Record<string, string> = {};
            for (const [colName, colIndex] of map.entries()) {
                result[colName] = (cellTexts[colIndex] || "").trim();
            }
            return result;
        },

        /**
        * 🛠️ DEV TOOL: Prints a prompt to the console.
        * Copy the output and paste it into Gemini/ChatGPT to generate your config.
        */
        generateConfigPrompt: async () => {
            const html = await rootLocator.evaluate((el) => el.outerHTML);
            const separator = "=".repeat(50);
            const prompt = `
${separator}
🤖 COPY THE TEXT BELOW INTO GEMINI/ChatGPT 🤖
${separator}

I am using a Playwright helper factory called 'useTable'. 
I need you to generate the configuration object based on the HTML structure below.

Here is the table HTML:
\`\`\`html
${html}
\`\`\`

Based on this HTML, generate the configuration object matching this signature:
const table = useTable(page.locator('...'), {
    // Find the rows (exclude headers and empty spacer rows if possible)
    rowSelector: "...", // OR (root) => root.locator(...)
    
    // Find the column headers
    headerSelector: "...", // OR (root) => root.locator(...)
    
    // Find the cell (relative to a specific row)
    cellSelector: "...", // OR (row) => row.locator(...)
    
    // Find the "Next Page" button (if it exists in the HTML)
    paginationNextSelector: (root) => root.locator(...)
});

**Requirements:**
1. Prefer \`getByRole\` or \`getByTestId\` over CSS classes where possible.
2. If the table uses \`div\` structures (like React Table), ensure the \`rowSelector\` does not accidentally select the header row.
3. If there are "padding" or "loading" rows, use \`.filter()\` to exclude them.

${separator}
`;
            console.log(prompt);
        }

    };

    /**
     * 🛠️ DEV TOOL: Prints a prompt to help write a custom Pagination Strategy.
     * It snapshots the HTML *surrounding* the table to find buttons/scroll containers.
     */
    generateStrategyPrompt: async () => {
      // 1. Get the parent container (often holds the pagination controls)
      const container = rootLocator.locator('xpath=..'); 
      const html = await container.evaluate((el) => el.outerHTML);
      
      const prompt = `
==================================================
🤖 COPY INTO GEMINI/ChatGPT TO WRITE A STRATEGY 🤖
==================================================

I am using 'playwright-smart-table'. I need a custom Pagination Strategy.
The table is inside this container HTML:

\`\`\`html
${html.substring(0, 5000)} ... (truncated)
\`\`\`

Write a strategy that implements this interface:
type PaginationStrategy = (context: TableContext) => Promise<boolean>;

Requirements:
1. Identify the "Next" button OR the scroll container.
2. Return 'true' if data loaded, 'false' if end of data.
3. Use context.resolve() to find elements.
`;
      console.log(prompt);
    }
};