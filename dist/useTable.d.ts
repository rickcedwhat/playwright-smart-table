import { Locator } from '@playwright/test';
import { TableConfig } from './types';
export declare const useTable: (rootLocator: Locator, configOptions?: TableConfig) => {
    getHeaders: () => Promise<string[]>;
    getByRow: (filters: Record<string, string | RegExp | number>, options?: {
        exact?: boolean;
        maxPages?: number;
    }) => Promise<Locator>;
    getByCell: (rowFilters: Record<string, string | RegExp | number>, targetColumn: string) => Promise<Locator>;
    getRows: () => Promise<Record<string, string>[]>;
    getRowAsJSON: (filters: Record<string, string | RegExp | number>) => Promise<Record<string, string>>;
    /**
    * 🛠️ DEV TOOL: Prints a prompt to the console.
    * Copy the output and paste it into Gemini/ChatGPT to generate your config.
    */
    generateConfigPrompt: () => Promise<void>;
};
