#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMarkdownRenderer } from 'vitepress';
import { markdownFiles, snippetImports, validateDocSnippets } from './doc-snippets.mjs';

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs');
const md = await createMarkdownRenderer(docs, {
  highlight: code => code,
  config: md => md.use(validateDocSnippets),
});
let count = 0;
const failures = [];
for (const file of markdownFiles(docs)) {
  try {
    count += snippetImports(md, file).length;
  } catch (error) {
    failures.push(error.message);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Verified ${count} VitePress snippet imports.`);
}
