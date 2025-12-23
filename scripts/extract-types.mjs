import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TYPES_FILE = path.join(__dirname, '../src/types.ts');

/**
 * Extracts individual type definitions from src/types.ts
 * Returns a Map of type name -> complete type definition (with JSDoc)
 */
export function extractTypes() {
  if (!fs.existsSync(TYPES_FILE)) {
    console.error(`❌ Types file not found: ${TYPES_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(TYPES_FILE, 'utf8');
  const types = new Map();
  
  // Remove imports
  const contentNoImports = content.replace(/^import.*?;\n/gm, '').trim();
  
  // Find all export statements
  const exportRegex = /^export\s+(type|interface)\s+(\w+)/gm;
  const exports = [];
  let match;
  while ((match = exportRegex.exec(contentNoImports)) !== null) {
    exports.push({
      kind: match[1],
      name: match[2],
      index: match.index,
      fullMatch: match[0]
    });
  }
  
  // Extract each type
  for (let i = 0; i < exports.length; i++) {
    const exp = exports[i];
    const startIdx = exp.index;
    
    // Get the text from this export to the next export (or end)
    const endIdx = i < exports.length - 1 ? exports[i + 1].index : contentNoImports.length;
    let typeBlock = contentNoImports.substring(startIdx, endIdx);
    
    // Find the actual end of this type definition
    let actualEnd = typeBlock.length;
    
    if (exp.kind === 'type') {
      // For types with '=', find the semicolon (accounting for braces/parens)
      const equalIdx = typeBlock.indexOf('=');
      if (equalIdx !== -1) {
        let braceCount = 0;
        let parenCount = 0;
        let angleCount = 0; // For generics
        
        for (let j = equalIdx + 1; j < typeBlock.length; j++) {
          const char = typeBlock[j];
          if (char === '{') braceCount++;
          if (char === '}') {
            braceCount--;
            // If we closed all braces and next char is semicolon, we're done
            if (braceCount === 0 && j + 1 < typeBlock.length && typeBlock[j + 1] === ';') {
              actualEnd = j + 2;
              break;
            }
            if (braceCount === 0 && typeBlock.substring(j + 1).trim().startsWith(';')) {
              actualEnd = typeBlock.indexOf(';', j) + 1;
              break;
            }
          }
          if (char === '(') parenCount++;
          if (char === ')') parenCount--;
          if (char === '<') angleCount++;
          if (char === '>') angleCount--;
          // Semicolon at top level (no unclosed braces/parens/angles)
          if (char === ';' && braceCount === 0 && parenCount === 0 && angleCount === 0) {
            actualEnd = j + 1;
            break;
          }
        }
      }
    } else {
      // For interfaces, find the matching closing brace
      const openBraceIdx = typeBlock.indexOf('{');
      if (openBraceIdx !== -1) {
        let braceCount = 0;
        for (let j = openBraceIdx; j < typeBlock.length; j++) {
          if (typeBlock[j] === '{') braceCount++;
          if (typeBlock[j] === '}') {
            braceCount--;
            if (braceCount === 0) {
              actualEnd = j + 1;
              break;
            }
          }
        }
      }
    }
    
    typeBlock = typeBlock.substring(0, actualEnd).trim();
    
    // Find JSDoc before this export in original content
    const originalIdx = content.indexOf(`export ${exp.kind} ${exp.name}`);
    if (originalIdx > 0) {
      const beforeBlock = content.substring(Math.max(0, originalIdx - 1000), originalIdx);
      const jsdocMatch = beforeBlock.match(/(\/\*\*[\s\S]*?\*\/)\s*$/);
      if (jsdocMatch) {
        typeBlock = jsdocMatch[1] + '\n' + typeBlock;
      }
    }
    
    types.set(exp.name, typeBlock.trim());
  }

  return types;
}

// If run directly, output for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const types = extractTypes();
  console.log(`Extracted ${types.size} types:\n`);
  for (const [name, def] of types.entries()) {
    const lines = def.split('\n');
    const preview = lines.slice(0, 5).join('\n');
    console.log(`=== ${name} === (${lines.length} lines)\n${preview}${lines.length > 5 ? '...' : ''}\n`);
  }
}
