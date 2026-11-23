#!/usr/bin/env node
import { accessSync, constants } from 'node:fs';
import { dirname, delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run from any host working directory. No shell, registry access or auto-build.
const entry = fileURLToPath(new URL('./dist/index.js', import.meta.url));
const script = fileURLToPath(import.meta.url);
function executable(name) {
  for (const directory of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    const path = join(directory, process.platform === 'win32' ? name + '.cmd' : name);
    try { accessSync(path, constants.X_OK); return path; } catch { /* Try the next PATH entry. */ }
  }
  throw new Error(`${name} is missing from PATH. Install the repo-declared pnpm, then regenerate the host config.`);
}
try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw new Error('Node 22.12+ is required; Node 24 is recommended.');
  accessSync(entry);
  if (process.argv.includes('--config')) {
    const path = [...new Set([dirname(process.execPath), dirname(executable('pnpm')), ...(process.env.PATH ?? '').split(delimiter).filter(Boolean)])].join(delimiter);
    console.log(JSON.stringify({ mcpServers: { 'smart-table-dev': { command: process.execPath, args: [script], env: { PATH: path }, timeoutSeconds: 130 } } }, null, 2));
  } else if (process.argv.length > 2) throw new Error('Usage: node packages/mcp/host.mjs [--config]');
  else {
    // pnpm subprocesses use this same Node even with a GUI host's minimal PATH.
    process.env.PATH = dirname(process.execPath) + delimiter + (process.env.PATH ?? '');
    executable('pnpm');
    await import('./dist/index.js');
  }
} catch (error) {
  console.error(`Smart Table MCP: ${error instanceof Error ? error.message : String(error)}\nFrom the checkout run pnpm install --frozen-lockfile, pnpm exec playwright install chromium, pnpm mcp:prepare, and pnpm mcp:build.`);
  process.exitCode = 1;
}
