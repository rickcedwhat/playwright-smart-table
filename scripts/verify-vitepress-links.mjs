#!/usr/bin/env node
/**
 * Verify VitePress themeConfig internal links (nav + sidebar) against the built site.
 *
 * Fragment targets (#anchors) are checked against id="..." in the generated HTML — the same
 * output users get from `vitepress build`, so this stays deterministic.
 *
 * Usage:
 *   npm run docs:build && npm run docs:verify-links
 *
 * Env:
 *   DOCS_DIST  — override path to dist (default: docs/.vitepress/dist)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'docs/.vitepress/config.mts');
const distRoot = process.env.DOCS_DIST
    ? path.resolve(process.env.DOCS_DIST)
    : path.join(root, 'docs/.vitepress/dist');

function resolveHtmlFile(pathname) {
    const normalized = pathname.replace(/\/+$/, '') || '/';
    if (normalized === '/') {
        return path.join(distRoot, 'index.html');
    }
    const asHtml = path.join(distRoot, `${normalized}.html`);
    if (fs.existsSync(asHtml)) {
        return asHtml;
    }
    const asIndex = path.join(distRoot, normalized, 'index.html');
    if (fs.existsSync(asIndex)) {
        return asIndex;
    }
    return null;
}

function collectElementIds(html) {
    const ids = new Set();
    const re = /\bid="([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        ids.add(m[1]);
    }
    return ids;
}

function extractInternalLinksFromConfig(source) {
    const out = new Set();
    const re = /\blink:\s*['"](\/[^'"]*)['"]/g;
    let m;
    while ((m = re.exec(source)) !== null) {
        const raw = m[1];
        if (raw.startsWith('//')) continue;
        out.add(raw);
    }
    return [...out];
}

function main() {
    if (!fs.existsSync(distRoot)) {
        console.error(`❌ Dist not found: ${distRoot}`);
        console.error('   Run: npm run docs:build');
        process.exit(1);
    }

    if (!fs.existsSync(configPath)) {
        console.error(`❌ Config not found: ${configPath}`);
        process.exit(1);
    }

    const configSource = fs.readFileSync(configPath, 'utf8');
    const links = extractInternalLinksFromConfig(configSource);

    const failures = [];

    for (const link of links) {
        const [pathPart, fragment] = link.split('#');

        // Ignore paths that only exist in development
        if (pathPart.startsWith('/lab')) continue;

        const htmlPath = resolveHtmlFile(pathPart);

        if (!htmlPath) {
            failures.push({ link, reason: `no HTML for path "${pathPart}"` });
            continue;
        }

        if (!fragment) {
            continue;
        }

        const html = fs.readFileSync(htmlPath, 'utf8');
        const ids = collectElementIds(html);
        if (!ids.has(fragment)) {
            const hint = suggestId(ids, fragment);
            failures.push({
                link,
                reason: `missing id="${fragment}" in ${path.relative(root, htmlPath)}${hint}`
            });
        }
    }

    if (failures.length > 0) {
        console.error('❌ VitePress link verification failed:\n');
        for (const f of failures) {
            console.error(`   • ${f.link}`);
            console.error(`     ${f.reason}\n`);
        }
        process.exit(1);
    }

    console.log(`✅ Verified ${links.length} internal nav/sidebar link(s) under ${path.relative(root, distRoot)}`);
}

/** If fragment missing, show a few similar ids (typos). */
function suggestId(ids, fragment) {
    const lower = fragment.toLowerCase();
    const similar = [...ids].filter(
        (id) =>
            id.includes(lower) ||
            lower.includes(id) ||
            levenshtein(id, fragment) <= 2
    );
    if (similar.length === 0) return '';
    const sample = similar.slice(0, 8).join(', ');
    return ` (similar ids: ${sample}${similar.length > 8 ? ', …' : ''})`;
}

function levenshtein(a, b) {
    if (a.length < b.length) [a, b] = [b, a];
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = i - 1;
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = row[j];
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
            prev = tmp;
        }
    }
    return row[b.length];
}

main();
