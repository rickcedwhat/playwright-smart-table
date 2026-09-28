import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// @playwright/test is an optional peer dependency (6.20.1). Compiled JS must never require
// Playwright at runtime — use `import type` in src/ (regressed in 6.21.0 via `errors`).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');
const forbidden = /require\(\s*["'](@playwright\/test|playwright|playwright-core)(\/[^"']*)?["']\s*\)/;

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
});

if (!fs.existsSync(distDir)) {
    console.error('❌ dist/ not found — run tsc first');
    process.exit(1);
}

const offenders = walk(distDir).filter((file) => forbidden.test(fs.readFileSync(file, 'utf8')));

if (offenders.length > 0) {
    console.error('❌ Runtime Playwright require found in compiled output (use `import type` instead):');
    for (const file of offenders) console.error(`   ${path.relative(path.join(__dirname, '..'), file)}`);
    process.exit(1);
}

console.log('✅ No runtime Playwright requires in dist/');
