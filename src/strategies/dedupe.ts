
import { DedupeStrategy } from '../types';

export const DedupeStrategies = {
    /**
     * Deduplicates rows based on their vertical position (Y coordinate).
     * Useful for virtualized tables where row DOM elements are reused but content changes.
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
