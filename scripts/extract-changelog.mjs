#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const version = process.argv[2];
if (!version) {
  // Nothing to do
  process.exit(0);
}

const changelogPath = path.resolve(process.cwd(), 'CHANGELOG.md');
if (!fs.existsSync(changelogPath)) {
  process.exit(0);
}

const raw = fs.readFileSync(changelogPath, 'utf8');
const header = `## [${version}]`;
const start = raw.indexOf(header);
if (start === -1) {
  // Section not found
  process.exit(0);
}

const afterHeader = raw.slice(start + header.length);
const lines = afterHeader.split(/\r?\n/);
const collected = [];
for (const line of lines) {
  if (line.startsWith('## [')) break;
  collected.push(line);
}

const body = collected.join('\n').trim();
if (!body) process.exit(0);

console.log(body);

