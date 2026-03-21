#!/usr/bin/env node
/**
 * install-apps.mjs
 * 
 * Auto-discovers all sub-apps (playground, tests/apps/\*) that have their own
 * package.json and runs `npm ci` in each one.
 * 
 * Add new preset playgrounds under tests/apps/ — this script picks them up automatically.
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

// Directories to scan for sub-app package.json files (non-recursive)
const SCAN_DIRS = [
  'playground',
  'tests/apps',
];

const apps = [];

for (const scanDir of SCAN_DIRS) {
  const absDir = join(ROOT, scanDir);
  if (!existsSync(absDir)) continue;

  const stat = statSync(absDir);

  if (stat.isDirectory()) {
    // Check if the dir itself is an app (e.g. playground/)
    if (existsSync(join(absDir, 'package.json'))) {
      apps.push(absDir);
    } else {
      // Scan one level deep (e.g. tests/apps/mui-datagrid/)
      for (const entry of readdirSync(absDir)) {
        const child = join(absDir, entry);
        if (statSync(child).isDirectory() && existsSync(join(child, 'package.json'))) {
          apps.push(child);
        }
      }
    }
  }
}

if (apps.length === 0) {
  console.log('No sub-apps found to install.');
  process.exit(0);
}

console.log(`\n📦 Installing dependencies for ${apps.length} sub-app(s):\n`);

let failed = false;

for (const appDir of apps) {
  const rel = appDir.replace(ROOT + '/', '');
  console.log(`  → ${rel}`);
  try {
    execSync('npm ci', { cwd: appDir, stdio: 'inherit' });
    console.log(`  ✅ ${rel} done\n`);
  } catch (e) {
    console.error(`  ❌ Failed to install ${rel}\n`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
