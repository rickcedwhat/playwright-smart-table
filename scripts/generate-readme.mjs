import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTypes } from './extract-types.mjs';

// 1. Recreate __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SOURCE_FILE = path.join(__dirname, '../tests/readme_verification.spec.ts');
const TARGET_FILE = path.join(__dirname, '../README.md');

function run() {
  console.log('📖 Updating README.md from tests and types...');

  // 1. Extract code snippets from tests
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`❌ Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }
  const sourceContent = fs.readFileSync(SOURCE_FILE, 'utf8');

  // 2. Extract Regions
  const regionRegex = /\/\/ #region\s+([a-zA-Z0-9_-]+)\n([\s\S]*?)\/\/ #endregion\s+\1/g;
  const snippets = new Map();
  
  let match;
  while ((match = regionRegex.exec(sourceContent)) !== null) {
    const regionName = match[1];
    const cleanCode = match[2].replace(/^    /gm, '').trim(); 
    snippets.set(regionName, cleanCode);
    console.log(`   found code region: ${regionName}`);
  }

  // 3. Extract types
  const types = extractTypes();
  console.log(`   found ${types.size} type definitions`);

  // 4. Read & Update README
  if (!fs.existsSync(TARGET_FILE)) {
    console.error(`❌ Target file not found: ${TARGET_FILE}`);
    process.exit(1);
  }
  
  let readmeContent = fs.readFileSync(TARGET_FILE, 'utf8');
  let updatedCount = 0;

  // 5. Update code snippets (<!-- embed: name -->)
  const embedRegex = /(<!-- embed:\s+([a-zA-Z0-9_-]+)\s+-->)([\s\S]*?)(<!-- \/embed:\s+\2\s+-->)/g;

  let newReadme = readmeContent.replace(embedRegex, (fullMatch, startTag, regionName, currentContent, endTag) => {
    if (snippets.has(regionName)) {
      updatedCount++;
      return `${startTag}\n\`\`\`typescript\n${snippets.get(regionName)}\n\`\`\`\n${endTag}`;
    }
    
    // Check if it's a type embedding (<!-- embed-type: TypeName -->)
    if (types.has(regionName)) {
      updatedCount++;
      return `${startTag}\n\`\`\`typescript\n${types.get(regionName)}\n\`\`\`\n${endTag}`;
    }
    
    console.warn(`   ⚠️ Warning: Region '${regionName}' found in README but not in test file or types.`);
    return fullMatch;
  });

  // 6. Update type embeddings (<!-- embed-type: TypeName -->)
  const typeEmbedRegex = /(<!-- embed-type:\s+([a-zA-Z0-9_-]+)\s+-->)([\s\S]*?)(<!-- \/embed-type:\s+\2\s+-->)/g;
  
  newReadme = newReadme.replace(typeEmbedRegex, (fullMatch, startTag, typeName, currentContent, endTag) => {
    if (types.has(typeName)) {
      updatedCount++;
      return `${startTag}\n\`\`\`typescript\n${types.get(typeName)}\n\`\`\`\n${endTag}`;
    }
    console.warn(`   ⚠️ Warning: Type '${typeName}' not found.`);
    return fullMatch;
  });

  // 7. Write back
  if (readmeContent !== newReadme) {
    fs.writeFileSync(TARGET_FILE, newReadme);
    console.log(`✅ README.md updated with ${updatedCount} snippets/types.`);
  } else {
    console.log('✨ README.md is already up to date.');
  }
}

run();
