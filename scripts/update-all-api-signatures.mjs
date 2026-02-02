#!/usr/bin/env node

/**
 * Universal API signature updater - works across all API documentation files.
 * Finds <!-- api-signature: name --> tags and updates signatures from TypeScript.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load all generated signature files
const signaturesDir = path.join(rootDir, 'docs/.vitepress');
const signatureFiles = {
    tableresult: 'tableresult-signatures.json',
    tableconfig: 'tableconfig-signatures.json',
    smartrow: 'smartrow-signatures.json',
    tablestrategies: 'tablestrategies-signatures.json'
};

// Combine all signatures into one map
const allSignatures = new Map();

Object.entries(signatureFiles).forEach(([type, filename]) => {
    const filepath = path.join(signaturesDir, filename);
    if (fs.existsSync(filepath)) {
        const sigs = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        sigs.forEach(sig => {
            allSignatures.set(sig.name, sig);
        });
        console.log(`📖 Loaded ${sigs.length} signatures from ${type}`);
    }
});

console.log(`\n✅ Total signatures loaded: ${allSignatures.size}\n`);

// Files to process
const docsFiles = [
    'docs/api/table-methods.md',
    'docs/api/table-config.md',
    'docs/api/smart-row.md',
    'docs/api/strategies.md'
];

let totalUpdates = 0;

docsFiles.forEach(relPath => {
    const filepath = path.join(rootDir, relPath);

    if (!fs.existsSync(filepath)) {
        console.log(`⚠️  Skipping ${relPath} (not found)`);
        return;
    }

    let content = fs.readFileSync(filepath, 'utf-8');
    let fileUpdates = 0;

    // Pattern: <!-- api-signature: name -->...<!-- /api-signature: name -->
    const embedRegex = /(<!-- api-signature:\s+(\w+)\s+-->)([\s\S]*?)(<!-- \/api-signature:\s+\2\s+-->)/g;

    const newContent = content.replace(embedRegex, (fullMatch, startTag, name, currentContent, endTag) => {
        const sig = allSignatures.get(name);

        if (!sig) {
            console.log(`   ⚠️  Signature not found: ${name}`);
            return fullMatch;
        }

        // Generate signature block
        let block = '\n\n### Signature\n\n```typescript\n';
        block += formatSignature(name, sig.signature);
        block += '\n```\n';

        // Add parameters if in comment
        const params = extractParams(sig.comment);
        if (params.length > 0) {
            block += '\n### Parameters\n\n';
            params.forEach(p => {
                block += `- \`${p.name}\` - ${p.desc}\n`;
            });
        }

        fileUpdates++;
        return startTag + block + '\n' + endTag;
    });

    if (content !== newContent) {
        fs.writeFileSync(filepath, newContent);
        console.log(`✅ ${path.basename(filepath)}: Updated ${fileUpdates} signatures`);
        totalUpdates += fileUpdates;
    } else {
        console.log(`   ${path.basename(filepath)}: No changes needed`);
    }
});

console.log(`\n📊 Total signatures updated: ${totalUpdates}`);

// Helper functions
function formatSignature(name, sig) {
    // Clean up signature for better display
    const cleanSig = sig.replace(/^\s+/, '').replace(/;$/, '');

    // Special formatting for known methods
    const formatters = {
        init: () => 'init(options?: { timeout?: number }): Promise<TableResult>',
        isInitialized: () => 'isInitialized(): boolean',
        getHeaders: () => 'getHeaders(): Promise<string[]>',
        getHeaderCell: () => 'getHeaderCell(columnName: string): Promise<Locator>',
        getRow: () => 'getRow(\n  filters: Record<string, string | RegExp | number>,\n  options?: { exact?: boolean }\n): SmartRow',
        getRowByIndex: () => 'getRowByIndex(\n  index: number,\n  options?: { bringIntoView?: boolean }\n): SmartRow',
        findRow: () => 'findRow(\n  filters: Record<string, string | RegExp | number>,\n  options?: { exact?: boolean, maxPages?: number }\n): Promise<SmartRow>',
        findRows: () => 'findRows(\n  filters: Record<string, string | RegExp | number>,\n  options?: { exact?: boolean, maxPages?: number }\n): Promise<SmartRow[]>',
        getRows: () => 'getRows(options?: {\n  filter?: Record<string, any>,\n  exact?: boolean\n}): Promise<SmartRowArray>',
        reset: () => 'reset(): Promise<void>',
        revalidate: () => 'revalidate(): Promise<void>',
        scrollToColumn: () => 'scrollToColumn(columnName: string): Promise<void>',
        getColumnValues: () => 'getColumnValues<V = string>(\n  column: string,\n  options?: {\n    mapper?: (cell: Locator) => Promise<V> | V,\n    maxPages?: number\n  }\n): Promise<V[]>',
        getCell: () => 'getCell(columnName: string): Locator',
        toJSON: () => 'toJSON(options?: { columns?: string[] }): Promise<T>',
        bringIntoView: () => 'bringIntoView(): Promise<void>',
        smartFill: () => 'smartFill(\n  data: Partial<T>,\n  options?: FillOptions\n): Promise<void>',
        headerSelector: () => 'headerSelector?: Selector',
        rowSelector: () => 'rowSelector?: Selector',
        cellSelector: () => 'cellSelector?: Selector',
        maxPages: () => 'maxPages?: number',
        headerTransformer: () => 'headerTransformer?: (args: {\n  text: string,\n  index: number,\n  locator: Locator\n}) => string | Promise<string>',
        debug: () => 'debug?: boolean | DebugConfig',
        strategies: () => 'strategies?: Partial<TableStrategies>'
    };

    return formatters[name] ? formatters[name]() : cleanSig;
}

function extractParams(comment) {
    if (!comment) return [];
    const paramMatches = [...comment.matchAll(/\*\s*@param\s+(\w+)\s+-?\s*(.+)/g)];
    return paramMatches.map(m => ({ name: m[1], desc: m[2].trim() }));
}
