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
export declare function createSmartRowArray<T>(rows: SmartRow<T>[]): SmartRowArray<T>;
