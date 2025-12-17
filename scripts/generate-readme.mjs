import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Recreate __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SOURCE_FILE = path.join(__dirname, '../tests/readme_verification.spec.ts');
const TARGET_FILE = path.join(__dirname, '../README.md');

function run() {
  console.log('📖 Updating README.md from tests...');

  // 1. Read Source File
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`❌ Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }
  const sourceContent = fs.readFileSync(SOURCE_FILE, 'utf8');

  // 2. Extract Regions
  // Regex looks for: // #region name \n (content) \n // #endregion name
  const regionRegex = /\/\/ #region\s+([a-zA-Z0-9_-]+)\n([\s\S]*?)\/\/ #endregion\s+\1/g;
  const snippets = new Map();
  
  let match;
  while ((match = regionRegex.exec(sourceContent)) !== null) {
    const regionName = match[1];
    // Clean up indentation: Remove 4 spaces (standard test indent) from start of lines
    const cleanCode = match[2].replace(/^    /gm, '').trim(); 
    snippets.set(regionName, cleanCode);
    console.log(`   found region: ${regionName}`);
  }

  // 3. Read & Update README
  if (!fs.existsSync(TARGET_FILE)) {
    console.error(`❌ Target file not found: ${TARGET_FILE}`);
    process.exit(1);
  }
  
  let readmeContent = fs.readFileSync(TARGET_FILE, 'utf8');
  let updatedCount = 0;

  // Regex looks for: <!-- embed: name --> (content) <!-- /embed: name -->
  // Defined explicitly before usage
  const embedRegex = /(<!-- embed:\s+([a-zA-Z0-9_-]+)\s+-->)([\s\S]*?)(<!-- \/embed:\s+\2\s+-->)/g;

  const newReadme = readmeContent.replace(embedRegex, (fullMatch, startTag, regionName, currentContent, endTag) => {
    if (!snippets.has(regionName)) {
      console.warn(`   ⚠️ Warning: Region '${regionName}' found in README but not in test file.`);
      return fullMatch; // Don't change anything
    }

    updatedCount++;
    // Reconstruct the block with the fresh code wrapped in typescript fences
    return `${startTag}\n\`\`\`typescript\n${snippets.get(regionName)}\n\`\`\`\n${endTag}`;
  });

  // 4. Write back
  if (readmeContent !== newReadme) {
    fs.writeFileSync(TARGET_FILE, newReadme);
    console.log(`✅ README.md updated with ${updatedCount} snippets.`);
  } else {
    console.log('✨ README.md is already up to date.');
  }
}

run();