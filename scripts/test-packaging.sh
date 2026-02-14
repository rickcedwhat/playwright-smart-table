#!/bin/bash
set -e

echo "📦 Testing packaging..."

# 1. Build the library
echo "🔨 Building library..."
npm run build

# 2. Pack the library
echo "📦 Packing library..."
npm pack
TARBALL=$(ls *.tgz)

# 3. Create temp directory
echo "📂 Creating temp directory..."
mkdir -p temp-test
cd temp-test

# 4. Init temp project
echo "🛠️ Initializing temp project..."
npm init -y
# Install dependencies needed for compilation (playwright types)
npm install typescript @types/node @playwright/test --save-dev

# 5. Install the tarball
echo "📥 Installing tarball..."
npm install ../$TARBALL

# 6. Create smoke test file
echo "📝 Creating smoke test..."
cat <<EOF > smoke-test.ts
import { useTable } from '@rickcedwhat/playwright-smart-table';
import { Page, Locator } from '@playwright/test';

// Just verify types are exported and usable
const test = async (page: Page) => {
    const table = useTable(page.locator('table'));
    await table.init();
    
    // Check if types are correct
    const headers: string[] = await table.getHeaders();
    console.log('Headers:', headers);
};
EOF

# 7. Compile smoke test
echo "Running tsc..."
npx tsc smoke-test.ts --noEmit --esModuleInterop

echo "✅ Packaging test passed! Types are correctly exported."

# Cleanup
cd ..
rm -rf temp-test $TARBALL
