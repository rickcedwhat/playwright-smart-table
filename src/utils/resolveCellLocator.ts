import type { Locator, Page } from '@playwright/test';
import type { FinalTableConfig, Selector } from '../types';

/**
 * Resolve a cell locator for a concrete row — prefers `strategies.getCellLocator`,
 * otherwise `cellSelector` + `.nth(columnIndex)`.
 */
export function resolveCellLocator(args: {
    config: FinalTableConfig;
    resolve: (selector: Selector, parent: Locator | Page) => Locator;
    row: Locator;
    root: Locator;
    columnName: string;
    columnIndex: number;
    rowIndex?: number;
    page?: Page;
}): Locator {
    const { config, resolve, row, root, columnName, columnIndex, rowIndex } = args;
    const page = args.page ?? root.page();
    if (config.strategies?.getCellLocator) {
        return config.strategies.getCellLocator({
            row,
            root,
            columnName,
            columnIndex,
            rowIndex,
            page,
            config,
        });
    }
    return resolve(config.cellSelector, row).nth(columnIndex);
}

/**
 * Cell locator for Playwright `rows.filter({ has })`.
 *
 * When `getCellLocator` is set, pass `page.locator(':scope')` as the row so the
 * strategy's `row.locator(...)` chain stays relative to each candidate row under
 * `filter({ has })`. Using the rows collection or a document-rooted parent nests
 * the row selector and matches nothing.
 *
 * Without `getCellLocator`, keeps the historical page-scoped `cellSelector.nth(i)`
 * template that Playwright re-bases into each row.
 */
export function resolveCellLocatorForFilter(args: {
    config: FinalTableConfig;
    resolve: (selector: Selector, parent: Locator | Page) => Locator;
    page: Page;
    root?: Locator;
    columnName: string;
    columnIndex: number;
}): Locator {
    const { config, resolve, page, root, columnName, columnIndex } = args;
    if (config.strategies?.getCellLocator) {
        const scopeRow = page.locator(':scope');
        return config.strategies.getCellLocator({
            row: scopeRow,
            root: root ?? scopeRow,
            columnName,
            columnIndex,
            page,
            config,
        });
    }
    return resolve(config.cellSelector, page).nth(columnIndex);
}
