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

// One signature map per interface. Names overlap across interfaces
// (e.g. `filter` / `sorting` are both TableResult members and strategies),
// so each doc page only looks up its own interface.
const signaturesByType = {};

Object.entries(signatureFiles).forEach(([type, filename]) => {
    const filepath = path.join(signaturesDir, filename);
    const map = new Map();
    if (fs.existsSync(filepath)) {
        const sigs = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        sigs.forEach(sig => map.set(sig.name, sig));
        console.log(`📖 Loaded ${sigs.length} signatures from ${type}`);
    }
    signaturesByType[type] = map;
});

const docsFiles = {
    'docs/api/table-methods.md': 'tableresult',
    'docs/api/table-config.md': 'tableconfig',
    'docs/api/smart-row.md': 'smartrow',
    'docs/api/strategies.md': 'tablestrategies'
};

let totalUpdates = 0;
let missing = 0;

Object.entries(docsFiles).forEach(([relPath, type]) => {
    const allSignatures = signaturesByType[type];
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
            console.log(`   ❌ ${path.basename(filepath)}: signature not found in ${type}: ${name}`);
            missing++;
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

if (missing > 0) {
    console.error(`\n❌ ${missing} api-signature tag(s) reference names that don't exist in src/types.ts.`);
    process.exit(1);
}

// Helper functions

// Signatures always come from src/types.ts — never hardcode them here, or the
// published docs drift from the real API (see #441).
function formatSignature(_name, sig) {
    const lines = sig.replace(/;$/, '').split('\n').map(l => l.trim()).filter(Boolean);
    return lines
        .map((line, i) => (i === 0 || /^[)}\]]/.test(line) ? line : `  ${line}`))
        .join('\n');
}

function extractParams(comment) {
    if (!comment) return [];
    const paramMatches = [...comment.matchAll(/\*\s*@param\s+(\w+)\s+-?\s*(.+)/g)];
    return paramMatches.map(m => ({ name: m[1], desc: m[2].trim() }));
}
