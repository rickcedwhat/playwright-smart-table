import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0));
for (const args of [
  ['packages/mcp/dist/index.js', '--http'],
  ['node_modules/vite/bin/vite.js', 'packages/inspector', '--config', 'packages/inspector/vite.config.ts'],
]) {
  // Resolve Vite from the UI's own dependencies rather than the library's VitePress.
  if (args[0].startsWith('node_modules')) args[0] = 'packages/inspector/' + args[0];
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 1); });
}
