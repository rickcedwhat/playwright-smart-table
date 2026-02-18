import type { Locator, Page } from '@playwright/test';
import { FinalTableConfig, TableContext, Selector, HeaderStrategy, TableStrategies } from '../types';
import { HeaderStrategies } from '../strategies/headers';
import { logDebug } from '../utils/debugUtils';

export class TableMapper {
    private _headerMap: Map<string, number> | null = null;
    private config: FinalTableConfig;
    private rootLocator: Locator;
    private resolve: (item: Selector, parent: Locator | Page) => Locator;

    constructor(
        rootLocator: Locator,
        config: FinalTableConfig,
        resolve: (item: Selector, parent: Locator | Page) => Locator
    ) {
        this.rootLocator = rootLocator;
        this.config = config;
        this.resolve = resolve;
    }

    private log(msg: string) {
        logDebug(this.config, 'verbose', msg);
    }

    public async getMap(timeout?: number): Promise<Map<string, number>> {
        if (this._headerMap) return this._headerMap;

        this.log('Mapping headers...');
        const headerTimeout = timeout ?? 3000;
        const startTime = Date.now();

        if (this.config.autoScroll) {
            try { await this.rootLocator.scrollIntoViewIfNeeded({ timeout: 1000 }); } catch (e) { }
        }

        const headerLoc = this.resolve(this.config.headerSelector as Selector, this.rootLocator);
        const strategy = this.config.strategies.header || HeaderStrategies.visible;
        const context: TableContext = {
            root: this.rootLocator,
            config: this.config,
            page: this.rootLocator.page(),
            resolve: this.resolve
        };

        let lastError: Error | null = null;

        while (Date.now() - startTime < headerTimeout) {
            // 1. Wait for visibility
            try {
                await headerLoc.first().waitFor({ state: 'visible', timeout: 200 });
            } catch (e) {
                // Continue to check existing/loading state even if not strictly "visible" yet
            }

            // 2. Check Smart Loading State
            if (this.config.strategies.loading?.isHeaderLoading) {
                const isStable = !(await this.config.strategies.loading.isHeaderLoading(context));
                if (!isStable) {
                    this.log('Headers are loading/unstable... waiting');
                    await new Promise(r => setTimeout(r, 100));
                    continue;
                }
            }

            // 3. Attempt Scan
            try {
                const rawHeaders = await strategy(context);
                const entries = await this.processHeaders(rawHeaders);

                // Success
                this._headerMap = new Map(entries);
                this.log(`Mapped ${entries.length} columns: ${JSON.stringify(entries.map(e => e[0]))}`);
                return this._headerMap;

            } catch (e) {
                lastError = e as Error;
                this.log(`Header mapping failed (retrying): ${(e as Error).message}`);
                await new Promise(r => setTimeout(r, 100));
            }
        }

        throw lastError || new Error(`Timed out waiting for headers after ${headerTimeout}ms`);
    }

    public async remapHeaders(): Promise<void> {
        this._headerMap = null;
        await this.getMap();
    }

    public getMapSync(): Map<string, number> | null {
        return this._headerMap;
    }

    public isInitialized(): boolean {
        return this._headerMap !== null;
    }

    public clear(): void {
        this._headerMap = null;
    }

    private async processHeaders(rawHeaders: string[]): Promise<[string, number][]> {
        const seenHeaders = new Set<string>();
        const entries: [string, number][] = [];

        for (let i = 0; i < rawHeaders.length; i++) {
            let text = rawHeaders[i].trim() || `__col_${i}`;
            if (this.config.headerTransformer) {
                text = await this.config.headerTransformer({
                    text,
                    index: i,
                    locator: this.rootLocator.locator(this.config.headerSelector as string).nth(i),
                    seenHeaders
                });
            }
            entries.push([text, i]);
            seenHeaders.add(text);
        }

        // Validation: Check for empty table
        if (entries.length === 0) {
            throw new Error(`Initialization Error: No columns found using selector "${this.config.headerSelector}". Check your selector or ensure the table is visible.`);
        }

        // Validation: Check for duplicates
        const seen = new Set<string>();
        const duplicates = new Set<string>();
        for (const [name] of entries) {
            if (seen.has(name)) {
                duplicates.add(name);
            }
            seen.add(name);
        }

        if (duplicates.size > 0) {
            const dupList = Array.from(duplicates).map(d => `"${d}"`).join(', ');
            throw new Error(`Initialization Error: Duplicate column names found: ${dupList}. Use 'headerTransformer' to rename duplicate columns.`);
        }

        return entries;
    }
}
