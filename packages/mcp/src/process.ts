import { spawn } from 'node:child_process';
import { InspectorError } from './contracts.js';

/** Only owned process groups are terminated; no global port or process-name killing. */
export async function runProcess(command: string, args: string[], cwd: string, timeoutMs: number, signal: AbortSignal) {
    const child = spawn(command, args, { cwd, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: 'true' } });
    let output = '';
    let killed = false;
    let hardStop: ReturnType<typeof setTimeout> | undefined;
    const combined = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
    const kill = (name: NodeJS.Signals) => { try { if (child.pid) process.platform === 'win32' ? child.kill(name) : process.kill(-child.pid, name); } catch { /* already exited */ } };
    const abort = () => { if (killed) return; killed = true; kill('SIGTERM'); hardStop = setTimeout(() => kill('SIGKILL'), 2000); };
    const collect = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-16000); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    combined.addEventListener('abort', abort, { once: true });
    if (combined.aborted) abort();
    try {
        await new Promise<void>((resolve, reject) => {
            child.once('error', reject);
            child.once('close', code => killed ? reject(new InspectorError(signal.aborted ? 'CANCELLED' : 'TIME_BUDGET', 'Consumer cancelled or timed out; owned process group terminated.')) : code === 0 ? resolve() : reject(new InspectorError('CONSUMER_FAILED', output || `Consumer exited ${code}`)));
        });
    } finally { combined.removeEventListener('abort', abort); if (hardStop) clearTimeout(hardStop); if (killed) kill('SIGKILL'); }
}
