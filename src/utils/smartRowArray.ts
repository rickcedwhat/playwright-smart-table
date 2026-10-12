import { SmartRow } from '../types';

/**
 * Extended array type with a toJSON helper method
 */
export interface SmartRowArray<T = any> extends Array<SmartRow<T>> {
    /**
     * Converts all rows to JSON objects, reading sequentially to avoid competing viewport moves.
     */
    toJSON(): Promise<T[]>;
}

/**
 * Wraps a SmartRow array with a convenient toJSON() method
 */
export function createSmartRowArray<T>(rows: SmartRow<T>[]): SmartRowArray<T> {
    const arr = rows as SmartRowArray<T>;

    arr.toJSON = async (): Promise<T[]> => {
        const results: T[] = [];
        for (const row of rows) results.push(await row.toJSON());
        return results;
    };

    return arr;
}
