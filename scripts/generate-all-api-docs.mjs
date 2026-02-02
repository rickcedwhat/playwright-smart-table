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
    TableResult: /export interface TableResult<T = any> \{([\s\S]*?)\n\}/,
    TableConfig: /export interface TableConfig \{([\s\S]*?)\n\}/,
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
