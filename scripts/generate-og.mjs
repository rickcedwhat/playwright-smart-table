// Generates the social preview card (Open Graph image) by screenshotting
// scripts/og-template.html with Playwright at 1200x630.
//
//   node scripts/generate-og.mjs
//
// Output: docs/public/og.png
// Edit scripts/og-template.html to change the card, then re-run.

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(__dirname, 'og-template.html');
const outDir = path.join(__dirname, '..', 'docs', 'public');
const outPath = path.join(outDir, 'og.png');

const WIDTH = 1280;
const HEIGHT = 640;

async function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2, // crisp @2x output
  });

  await page.goto('file://' + templatePath, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
  await browser.close();

  console.log(`✅ Social card written to docs/public/og.png (${WIDTH}x${HEIGHT} @2x)`);
}

main().catch((e) => {
  console.error('❌ Failed to generate OG card:', e);
  process.exit(1);
});
