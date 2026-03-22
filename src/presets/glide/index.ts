import { TableContext, FillStrategy, TableConfig } from '../../types';
import {
    glideGoUp,
    glideGoDown,
    glideGoLeft,
    glideGoRight,
    glideSnapFirstColumnIntoView,
    glideSeekColumnIndex
} from './columns';
import { scrollRightHeader } from './headers';
import { PaginationStrategies } from '../../strategies/pagination';
import { StabilizationStrategies } from '../../strategies/stabilization';

const glideFillStrategy: FillStrategy = async ({ row, columnName, value, page }) => {
    // Canvas-aware click: Glide is a canvas grid. The accessibility 'td' elements
    // may not trigger internal focus on a simple click. We click the canvas at the cell's location.
    const cell = row.getCell(columnName);
    const box = await cell.boundingBox();
    const canvas = page.locator('canvas').first();
    const cBox = await canvas.boundingBox();

    if (box && cBox) {
        await canvas.click({
            position: {
                x: box.x - cBox.x + box.width / 2,
                y: box.y - cBox.y + box.height / 2
            }
        });
    } else {
        // Fallback
        await cell.focus();
    }

    await page.keyboard.press('Enter');
    const textarea = page.locator('textarea.gdg-input');
    await textarea.waitFor({ state: 'visible', timeout: 2000 });
    await page.keyboard.type(String(value));
    await textarea.evaluate((el, expectedValue) => {
        return new Promise<void>((resolve) => {
            const checkValue = () => {
                if ((el as HTMLTextAreaElement).value === expectedValue) {
                    resolve();
                } else {
                    setTimeout(checkValue, 10);
                }
            };
            checkValue();
        });
    }, String(value));
    await page.waitForTimeout(50);
    await page.keyboard.press('Enter');
    await textarea.waitFor({ state: 'detached', timeout: 2000 });
    await page.waitForTimeout(300);
};

const glideFillSimple: FillStrategy = async ({ value, page }) => {
    await page.keyboard.press('Enter');
    await page.keyboard.type(String(value));
    await page.keyboard.press('Enter');
};

const glidePaginationStrategy = PaginationStrategies.infiniteScroll({
    scrollTarget: 'xpath=//ancestor::body//div[contains(@class, "dvn-scroller")]',
    scrollAmount: 500,
    action: 'js-scroll',
    stabilization: StabilizationStrategies.contentChanged({ timeout: 5000 }),
    timeout: 5000
});

const glideGetCellLocator = ({ row, columnIndex }: any) => {
    // WAI-ARIA: aria-colindex is 1-based; header map index 0 → "1", index 59 → "60".
    // Rows are virtualized: only a window of `td`s exists; navigation must scroll `.dvn-scroller`.
    return row.locator(`td[aria-colindex="${columnIndex + 1}"]`);
};

const glideGetActiveCell = async ({ page }: any) => {
    const focused = page.locator('*:focus').first();

    if (await focused.count() === 0) return null;

    const id = await focused.getAttribute('id') || '';
    const parts = id.split('-');

    let rowIndex = -1;
    let columnIndex = -1;

    if (parts.length >= 4 && parts[0] === 'glide' && parts[1] === 'cell') {
        columnIndex = parseInt(parts[2]) - 1;
        rowIndex = parseInt(parts[3]);
    }

    return {
        rowIndex,
        columnIndex,
        locator: focused
    };
};

/** Default strategies for the Glide preset (fill only; no fillSimple). */
const GlideDefaultStrategies = {
    fill: glideFillStrategy,
    pagination: glidePaginationStrategy,
    header: scrollRightHeader,
    navigation: {
        goUp: glideGoUp,
        goDown: glideGoDown,
        goLeft: glideGoLeft,
        goRight: glideGoRight,
        goHome: glideSnapFirstColumnIntoView,
        snapFirstColumnIntoView: glideSnapFirstColumnIntoView,
        seekColumnIndex: glideSeekColumnIndex
    },
    loading: {
        isHeaderLoading: async () => false
    },
    getCellLocator: glideGetCellLocator,
    getActiveCell: glideGetActiveCell
};

/** Strategies only for Glide Data Grid. Includes fillSimple; use when you want to supply your own selectors or override fill. */
export const GlideStrategies = {
    ...GlideDefaultStrategies,
    fillSimple: glideFillSimple
};

/**
 * Full preset for Glide Data Grid (selectors + default strategies only).
 * Spread: useTable(loc, { ...Plugins.Glide, maxPages: 5 }).
 * Strategies only (including fillSimple): useTable(loc, { rowSelector: '...', strategies: Plugins.Glide.Strategies }).
 */
const GlidePreset: Partial<TableConfig> = {
    headerSelector: 'table[role="grid"] thead tr th',
    rowSelector: 'table[role="grid"] tbody tr',
    cellSelector: 'td',
    concurrency: 'sequential',
    strategies: GlideDefaultStrategies
};
export const Glide: Partial<TableConfig> & { Strategies: typeof GlideStrategies } = Object.defineProperty(
    GlidePreset,
    'Strategies',
    { get: () => GlideStrategies, enumerable: false }
) as Partial<TableConfig> & { Strategies: typeof GlideStrategies };
