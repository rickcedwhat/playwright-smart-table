import { TableContext, TableConfig } from '../types';
/** Full strategies for React Data Grid. Use when you want to supply your own selectors: strategies: Plugins.RDG.Strategies */
export declare const RDGStrategies: {
    header: (context: TableContext) => Promise<string[]>;
    getCellLocator: ({ row, columnIndex }: any) => any;
    navigation: {
        goRight: ({ root, page }: any) => Promise<void>;
        goLeft: ({ root, page }: any) => Promise<void>;
        goDown: ({ root, page }: any) => Promise<void>;
        goUp: ({ root, page }: any) => Promise<void>;
        goHome: ({ root, page }: any) => Promise<void>;
    };
    pagination: import("../types").PaginationPrimitives;
};
export declare const RDG: Partial<TableConfig> & {
    Strategies: typeof RDGStrategies;
};
