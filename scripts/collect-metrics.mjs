#!/usr/bin/env node
/**
 * collect-metrics.mjs
 *
 * Snapshots library health for the current package version and appends
 * (or updates) a single entry in metrics/history.json.
 *
 * Metrics collected:
 *   - distSizeKB      — total size of the dist/ folder
 *   - publicApiCount  — total exported members across all four interfaces
 *   - unitTestCount   — total unit tests (requires test-results.json from vitest --reporter=json)
 *   - unitTestPass    — passing unit tests
 *   - mutationScore   — mutation score % (optional; reads reports/mutation/mutation.json if present)
 *
 * Usage (in CI, after build + unit tests):
 *   node scripts/collect-metrics.mjs
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ── 1. Version & date ────────────────────────────────────────────────────────
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const version = pkg.version;
const date = new Date().toISOString().split('T')[0];

// ── 2. Dist size (KB) ────────────────────────────────────────────────────────
let distSizeKB = null;
try {
    const distPath = path.join(rootDir, 'dist');
    const output = execSync(`du -sk "${distPath}"`, { encoding: 'utf-8' });
    distSizeKB = parseInt(output.split('\t')[0], 10);
} catch {
    // dist may not exist in some environments
}

// ── 3. Public API surface (from generated signatures JSON) ───────────────────
const signatureFiles = ['tableresult', 'tableconfig', 'smartrow', 'tablestrategies'];
let publicApiCount = 0;
const publicApiBreakdown = {};
for (const name of signatureFiles) {
    const sigPath = path.join(rootDir, `docs/.vitepress/${name}-signatures.json`);
    try {
        const sigs = JSON.parse(fs.readFileSync(sigPath, 'utf-8'));
        publicApiBreakdown[name] = sigs.length;
        publicApiCount += sigs.length;
    } catch {
        publicApiBreakdown[name] = null;
    }
}

// ── 4. Unit test results (vitest --reporter=json output) ─────────────────────
let unitTestCount = null;
let unitTestPass = null;
const jsonReportPath = path.join(rootDir, 'test-results.json');
try {
    if (fs.existsSync(jsonReportPath)) {
        const report = JSON.parse(fs.readFileSync(jsonReportPath, 'utf-8'));
        unitTestCount = report.numTotalTests ?? null;
        unitTestPass = report.numPassedTests ?? null;
    }
} catch {
    // report may be malformed; skip gracefully
}

// ── 5. Mutation score (optional) ─────────────────────────────────────────────
let mutationScore = null;
const mutationReportPath = path.join(rootDir, 'reports/mutation/mutation.json');
try {
    if (fs.existsSync(mutationReportPath)) {
        const report = JSON.parse(fs.readFileSync(mutationReportPath, 'utf-8'));
        mutationScore =
            typeof report.metrics?.mutationScore === 'number'
                ? Math.round(report.metrics.mutationScore * 10) / 10
                : null;
    }
} catch {
    // Stryker report absent or malformed; skip gracefully
}

// ── Build entry ───────────────────────────────────────────────────────────────
const entry = {
    version,
    date,
    distSizeKB,
    publicApiCount,
    publicApiBreakdown,
    unitTestCount,
    unitTestPass,
    ...(mutationScore !== null ? { mutationScore } : {}),
};

// ── Read / update history ─────────────────────────────────────────────────────
const historyPath = path.join(rootDir, 'metrics/history.json');
let history = [];
try {
    history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
} catch {
    // first run; start fresh
}

const existingIdx = history.findIndex(e => e.version === version);
if (existingIdx >= 0) {
    history[existingIdx] = entry;
    console.log(`🔄 Updated metrics for existing entry v${version}`);
} else {
    history.push(entry);
    console.log(`✅ Appended metrics for v${version}`);
}

// Sort by semver (newest last) so the file reads chronologically
history.sort((a, b) => {
    const pa = a.version.split('.').map(Number);
    const pb = b.version.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
});

fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + '\n');

// ── Console summary ───────────────────────────────────────────────────────────
const prev = history.length >= 2 ? history[history.length - 2] : null;
const delta = (curr, prevVal, unit = '') => {
    if (prevVal == null || curr == null) return '';
    const d = curr - prevVal;
    if (d === 0) return ' (→ no change)';
    return d > 0 ? ` (↑ +${d}${unit})` : ` (↓ ${d}${unit})`;
};

console.log(`\n📊 Library health — v${version} (${date})`);
console.log(`   Dist size:       ${distSizeKB ?? '?'} KB${delta(distSizeKB, prev?.distSizeKB, ' KB')}`);
console.log(`   Public API:      ${publicApiCount} members${delta(publicApiCount, prev?.publicApiCount)}`);
console.log(`   Unit tests:      ${unitTestPass ?? '?'}/${unitTestCount ?? '?'} passing${delta(unitTestPass, prev?.unitTestPass)}`);
if (mutationScore !== null) {
    console.log(`   Mutation score:  ${mutationScore}%${delta(mutationScore, prev?.mutationScore, '%')}`);
}

// ── GitHub Actions step summary ───────────────────────────────────────────────
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
    const rows = [
        ['Metric', `v${version}`, prev ? `v${prev.version}` : 'prev', 'Δ'],
        ['---', '---', '---', '---'],
        [
            'Dist size',
            `${distSizeKB ?? '?'} KB`,
            prev ? `${prev.distSizeKB ?? '?'} KB` : '—',
            prev && distSizeKB != null && prev.distSizeKB != null
                ? `${distSizeKB - prev.distSizeKB > 0 ? '+' : ''}${distSizeKB - prev.distSizeKB} KB`
                : '—',
        ],
        [
            'Public API members',
            `${publicApiCount}`,
            prev ? `${prev.publicApiCount ?? '?'}` : '—',
            prev && prev.publicApiCount != null
                ? `${publicApiCount - prev.publicApiCount > 0 ? '+' : ''}${publicApiCount - prev.publicApiCount}`
                : '—',
        ],
        [
            'Unit tests (passing)',
            `${unitTestPass ?? '?'} / ${unitTestCount ?? '?'}`,
            prev ? `${prev.unitTestPass ?? '?'} / ${prev.unitTestCount ?? '?'}` : '—',
            prev && unitTestPass != null && prev.unitTestPass != null
                ? `${unitTestPass - prev.unitTestPass >= 0 ? '+' : ''}${unitTestPass - prev.unitTestPass}`
                : '—',
        ],
        ...(mutationScore !== null
            ? [
                  [
                      'Mutation score',
                      `${mutationScore}%`,
                      prev?.mutationScore != null ? `${prev.mutationScore}%` : '—',
                      prev?.mutationScore != null
                          ? `${mutationScore - prev.mutationScore >= 0 ? '+' : ''}${(mutationScore - prev.mutationScore).toFixed(1)}%`
                          : '—',
                  ],
              ]
            : []),
    ];

    const md = [
        `## 📊 Library Health — v${version}`,
        '',
        rows.map(r => `| ${r.join(' | ')} |`).join('\n'),
        '',
        `_Generated ${date}_`,
    ].join('\n');

    fs.appendFileSync(summaryPath, md + '\n');
}
