#!/usr/bin/env node
// VitePress silently renders the whole file when a named region is missing.
// Validate our named test imports before rendering so broken examples fail CI.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
let count = 0;
const failures = [];

function checkDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      checkDirectory(file);
      continue;
    }
    if (!entry.name.endsWith('.md')) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    let fence;
    for (const [index, line] of lines.entries()) {
      // Literal imports in fenced documentation are examples, not dependencies.
      const delimiter = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
      if (delimiter) {
        if (!fence) fence = delimiter;
        else if (delimiter[0] === fence[0] && delimiter.length >= fence.length) fence = undefined;
        continue;
      }
      if (fence || !/^ {0,3}<<<\s/.test(line)) continue;
      const location = `${path.relative(root, file)}:${index + 1}`;
      const match = /^ {0,3}<<<\s+([^\s#]+)#([\w-]+)\s*$/.exec(line);
      if (!match) {
        failures.push(`${location}: use a file path and named region (<<< path#name)`);
        continue;
      }
      const [, sourcePath, name] = match;
      const source = sourcePath.startsWith('@/')
        ? path.join(docs, sourcePath.slice(2))
        : path.resolve(path.dirname(file), sourcePath);
      try {
        const sourceLines = readFileSync(source, 'utf8').split(/\r?\n/);
        const starts = [];
        const ends = [];
        sourceLines.forEach((text, i) => {
          if (text.trim() === `// #region ${name}`) starts.push(i);
          if (text.trim() === `// #endregion ${name}`) ends.push(i);
        });
        if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0] || !sourceLines.slice(starts[0] + 1, ends[0]).join('\n').trim()) {
          throw new Error(`region '${name}' must have one ordered, nonempty start/end pair`);
        }
        count++;
      } catch (error) {
        failures.push(`${location}: ${sourcePath} — ${error.message}`);
      }
    }
  }
}

checkDirectory(docs);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Verified ${count} VitePress snippet imports.`);
}
