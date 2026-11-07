#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMarkdownRenderer } from 'vitepress';
import { changedDocPages } from './doc-snippets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const base = process.argv[2];
if (!base) throw new Error('Usage: node scripts/changed-doc-pages.mjs <base-ref>');
const changed = new Set(execFileSync('git', ['diff', '--name-only', '-z', base, 'HEAD'], {
  cwd: root, encoding: 'utf8',
}).split('\0').filter(Boolean).map(file => path.join(root, file)));
const md = await createMarkdownRenderer(docs, { highlight: code => code });
// JSON preserves the empty home-page route and filenames containing commas.
console.log(JSON.stringify(changedDocPages(md, docs, changed)));
