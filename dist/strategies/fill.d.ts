import type { FillStrategy } from '../types';
export declare const FillStrategies: {
    /**
     * Default strategy: Detects input type and fills accordingly (Text, Select, Checkbox, ContentEditable).
     */
    default: ({ row, columnName, value, fillOptions }: Parameters<FillStrategy>[0]) => Promise<void>;
};
