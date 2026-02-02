import { SmartRow } from '../types';

/**
 * Extended array type with a toJSON helper method
 */
export interface SmartRowArray<T = any> extends Array<SmartRow<T>> {
    /**
     * Converts all rows to JSON objects
     */
    toJSON(): Promise<T[]>;
}

/**
 * Wraps a SmartRow array with a convenient toJSON() method
 */
export function createSmartRowArray<T>(rows: SmartRow<T>[]): SmartRowArray<T> {
    const arr = rows as SmartRowArray<T>;

    arr.toJSON = async (): Promise<T[]> => {
        return Promise.all(rows.map(r => r.toJSON()));
    };

    return arr;
}
