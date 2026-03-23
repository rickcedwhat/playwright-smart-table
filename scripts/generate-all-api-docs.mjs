#!/usr/bin/env node

/**
 * Enhanced script to auto-generate API signatures for ALL API documentation.
 * Extracts from multiple TypeScript interfaces/types.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const typesPath = path.join(rootDir, 'src/types.ts');
const typesContent = fs.readFileSync(typesPath, 'utf-8');

// Extract multiple interfaces
const interfaces = {
    // TableResult extends AsyncIterable — keep regex in sync with src/types.ts declaration line.
    TableResult:
        /export interface TableResult<T = any> extends AsyncIterable<\{ row: SmartRow<T>; rowIndex: number \}> \{([\s\S]*?)\n\}/,
    TableConfig: /export interface TableConfig<T = any> \{([\s\S]*?)\n\}/,
    SmartRow: /export type SmartRow<T = any> = Locator & \{([\s\S]*?)\n\};/,
    TableStrategies: /export interface TableStrategies \{([\s\S]*?)\n\}/
};

const allSignatures = {};

Object.entries(interfaces).forEach(([name, pattern]) => {
    const match = typesContent.match(pattern);
    if (match) {
        console.log(`📖 Extracting ${name}...`);
        allSignatures[name] = extractMethods(match[1], name);
    }
});

function extractMethods(content, interfaceName) {
    const methods = [];
    const lines = content.split('\n');
    let currentComment = [];
    let currentSignature = '';
    let inComment = false;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('/**')) {
            inComment = true;
            currentComment = [line];
            if (line.endsWith('*/')) {
                inComment = false;
            }
            continue;
        }
        if (inComment) {
            currentComment.push(line);
            if (line.endsWith('*/')) {
                inComment = false;
            }
            continue;
        }

        if (!line || line.startsWith('//')) continue;

        // Multi-line method: forEach( / map<R>( / filter( — first line has no `name:` before `(`
        const multiMethod = line.match(/^([a-zA-Z_]\w*)(<[^>]+>)?\(\s*$/);
        if (multiMethod && !currentSignature) {
            const methodName = multiMethod[1];
            currentSignature = line;
            let parenDepth =
                (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
            while (parenDepth > 0 && i + 1 < lines.length) {
                i++;
                const cont = lines[i].trim();
                currentSignature += '\n  ' + cont;
                parenDepth += (cont.match(/\(/g) || []).length - (cont.match(/\)/g) || []).length;
            }
            methods.push({
                name: methodName,
                signature: currentSignature,
                comment: currentComment.join('\n')
            });
            currentSignature = '';
            currentComment = [];
            continue;
        }

        if (line.includes(':') && !currentSignature) {
            currentSignature = line;
            braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

            if ((line.endsWith(';') || line.endsWith('}')) && braceDepth === 0) {
                const methodName = line.split(':')[0].trim();
                methods.push({
                    name: methodName,
                    signature: currentSignature,
                    comment: currentComment.join('\n')
                });
                currentSignature = '';
                currentComment = [];
            }
        } else if (currentSignature) {
            currentSignature += '\n  ' + line;
            braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

            if ((line.endsWith(';') || line.endsWith('}')) && braceDepth === 0) {
                const methodName = currentSignature.split(':')[0].trim();
                methods.push({
                    name: methodName,
                    signature: currentSignature,
                    comment: currentComment.join('\n')
                });
                currentSignature = '';
                currentComment = [];
            }
        }
    }

    return methods;
}

// Write separate JSON files for each interface
Object.entries(allSignatures).forEach(([interfaceName, methods]) => {
    const outputPath = path.join(rootDir, `docs/.vitepress/${interfaceName.toLowerCase()}-signatures.json`);
    const formatted = methods.map(m => ({
        name: m.name.replace(/\(.*$/, '').trim(),
        signature: m.signature.replace(/;$/, '').trim(),
        comment: m.comment
    }));

    fs.writeFileSync(outputPath, JSON.stringify(formatted, null, 2));
    console.log(`✅ Generated ${interfaceName} signatures (${methods.length} methods)`);
});

console.log('\n📊 Summary:');
console.log(`   TableResult: ${allSignatures.TableResult?.length || 0} methods`);
console.log(`   TableConfig: ${allSignatures.TableConfig?.length || 0} properties`);
console.log(`   SmartRow: ${allSignatures.SmartRow?.length || 0} methods`);
console.log(`   TableStrategies: ${allSignatures.TableStrategies?.length || 0} strategies`);
