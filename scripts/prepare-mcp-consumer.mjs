import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const directory = mkdtempSync(join(tmpdir(), 'pst-mcp-pack-'));
const archive = join(directory, 'library.tgz');
execFileSync('pnpm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
execFileSync('pnpm', ['pack', '--out', archive], { cwd: root, stdio: 'inherit' });
const files = readdirSync(join(root, 'dist'), { recursive: true, withFileTypes: true }).filter(file => file.isFile()).map(file => join(file.parentPath, file.name)).sort();
const hash = createHash('sha256');
for (const file of files) { hash.update(relative(join(root, 'dist'), file)); hash.update(readFileSync(file)); }
let preparedFromCommit = 'unversioned-source';
try { preparedFromCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* Source snapshots still have an exact archive checksum. */ }
const manifest = { archive, sha256: createHash('sha256').update(readFileSync(archive)).digest('hex'), distDigest: hash.digest('hex'),
  version: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
  preparedFromCommit, packageDigest: createHash('sha256').update(readFileSync(join(root, 'package.json'))).digest('hex'),
  nodeTypes: require('@types/node/package.json').version,
  playwright: require('@playwright/test/package.json').version, typescript: require('typescript/package.json').version };
writeFileSync(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { '@rickcedwhat/playwright-smart-table': 'file:./library.tgz', '@playwright/test': manifest.playwright, typescript: manifest.typescript, '@types/node': manifest.nodeTypes } }));
manifest.storeDir = execFileSync('pnpm', ['store', 'path'], { cwd: directory, encoding: 'utf8' }).trim();
execFileSync('pnpm', ['install', '--store-dir', manifest.storeDir, '--ignore-scripts', '--config.node-linker=hoisted'], { cwd: directory, stdio: 'inherit' });
manifest.lockfile = join(directory, 'pnpm-lock.yaml');
writeFileSync(join(root, 'packages/mcp/.mcp-state.json'), JSON.stringify(manifest, null, 2));
console.log(`Prepared immutable consumer archive ${manifest.sha256} (${manifest.version}); pnpm offline cache is required.`);
