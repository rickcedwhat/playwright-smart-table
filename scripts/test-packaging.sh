#!/bin/bash
# Consumer smoke test for the packed tarball:
#   1. runtime — require() the package in a project WITHOUT @playwright/test (optional peer, 6.20.1)
#   2. types   — compile a consumer file against the published .d.ts with the latest TypeScript
#   3. compat  — repeat the type check with older TypeScript majors (TS_COMPAT_VERSIONS)
# Set SKIP_BUILD=1 when dist/ was already built in the same job.
set -euo pipefail

TS_COMPAT_VERSIONS="${TS_COMPAT_VERSIONS:-5 6}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

cd "$REPO_DIR"
EXPECTED_VERSION="$(node -p "require('./package.json').version")"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
    echo "🔨 Building library..."
    pnpm run build
fi

echo "📦 Packing library..."
pnpm pack --pack-destination "$WORK_DIR" >/dev/null
TARBALL="$(ls "$WORK_DIR"/*.tgz)"

# ── 1. Runtime load without Playwright ────────────────────────────────────────
echo "🚀 Runtime: loading the package without @playwright/test..."
mkdir "$WORK_DIR/runtime" && cd "$WORK_DIR/runtime"
npm init -y >/dev/null
npm install --no-audit --no-fund "$TARBALL" >/dev/null
if [ -d node_modules/@playwright/test ]; then
    echo "❌ @playwright/test was installed — the runtime check would not prove anything."
    exit 1
fi
EXPECTED_VERSION="$EXPECTED_VERSION" node -e "
const m = require('@rickcedwhat/playwright-smart-table');
if (typeof m.useTable !== 'function') throw new Error('useTable is not exported as a function');
if (m.PLAYWRIGHT_SMART_TABLE_VERSION !== process.env.EXPECTED_VERSION) {
  throw new Error('PLAYWRIGHT_SMART_TABLE_VERSION is ' + m.PLAYWRIGHT_SMART_TABLE_VERSION + ', expected ' + process.env.EXPECTED_VERSION);
}
console.log('   loaded ' + m.PLAYWRIGHT_SMART_TABLE_VERSION + ' (useTable, presets: ' + Object.keys(m.presets).length + ')');
require('@rickcedwhat/playwright-smart-table/types');
require('@rickcedwhat/playwright-smart-table/presets');
"

# ── 2. Types with the latest TypeScript ───────────────────────────────────────
echo "📝 Types: compiling a consumer against the published .d.ts..."
mkdir "$WORK_DIR/types" && cd "$WORK_DIR/types"
npm init -y >/dev/null
npm install --no-audit --no-fund typescript @types/node @playwright/test "$TARBALL" >/dev/null

cat <<'EOF' > smoke-test.ts
import { useTable, presets, PLAYWRIGHT_SMART_TABLE_VERSION } from '@rickcedwhat/playwright-smart-table';
import type { TableConfig, TableSelector, SmartRow } from '@rickcedwhat/playwright-smart-table';
import type { TableResult } from '@rickcedwhat/playwright-smart-table/types';
import type { Page } from '@playwright/test';

const version: string = PLAYWRIGHT_SMART_TABLE_VERSION;
export type SmokeTable = TableResult;
const rowSelector: TableSelector = (root) => root.locator('tbody tr');
const config: TableConfig = { rowSelector, headerSelector: 'thead th', maxPages: 2 };

export const smoke = async (page: Page) => {
    const table = useTable(page.locator('table'), { ...presets.muiDataGrid, ...config });
    await table.init();
    const headers: string[] = await table.getHeaders();
    const row: SmartRow = await table.findRow({ Name: 'Alice' });
    const data: Record<string, unknown> = await row.toJSON();
    return { version, headers, data };
};
EOF

# TypeScript 5.8+ (TS5112): passing .ts files on the CLI errors when any tsconfig.json is
# discoverable, so compile via a local project instead.
cat <<'EOF' > tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "ES2022",
    "lib": ["ES2022", "ESNext.Disposable", "DOM"],
    "types": ["node"],
    "module": "Node16",
    "moduleResolution": "Node16",
    "esModuleInterop": true,
    "skipLibCheck": false
  },
  "include": ["smoke-test.ts"]
}
EOF

echo "   typescript $(npx tsc --version)"
npx tsc --project tsconfig.json

# ── 3. Older TypeScript majors ────────────────────────────────────────────────
for ts in $TS_COMPAT_VERSIONS; do
    npm install --no-audit --no-fund --no-save "typescript@$ts" >/dev/null
    echo "   typescript $(npx tsc --version)"
    npx tsc --project tsconfig.json
done

echo "✅ Packaging test passed: runtime load without Playwright, types on latest + TS [$TS_COMPAT_VERSIONS]."
