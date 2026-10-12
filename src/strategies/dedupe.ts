
import { DedupeStrategy } from '../types';

export const DedupeStrategies = {
    /**
     * Groups rows by their viewport Y coordinate, rounded to a pixel bucket.
     * Only applicable when each screen position represents the same record for the entire scan.
     * Scrolling or pagination can place different records at the same position and silently drop them.
     * @deprecated Prefer a stable record key, e.g. `async row => row.getCell('ID').innerText()`.
     * Do not use for recycled virtualized rows or paginated tables.
     * @param tolerance Pixel tolerance for position comparison (default: 2)
     */
    byTopPosition: (tolerance = 2): DedupeStrategy => async (row) => {
        const box = await row.boundingBox();
        if (!box) return 'unknown';
        // Round to nearest tolerance
        const y = Math.round(box.y / tolerance) * tolerance;
        return `pos_${y}`;
    }
};
