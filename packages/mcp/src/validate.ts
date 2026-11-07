import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, readdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionManager } from './sessions.js';
import { InspectorError, successResult, urlSchema } from './contracts.js';
import { generateConfig } from './generate.js';
import { snapshot } from './navigation.js';
import { runProcess } from './process.js';
import { validationResultSchema, type Proposal, type WorkflowBudget } from './workflow-contracts.js';
import { saveValidation } from './bench/witness.js';

export async function validateConfig(sessions: SessionManager, id: string, proposal: Proposal, budget: WorkflowBudget, signal: AbortSignal) {
    return sessions.run(id, budget.timeoutMs, signal, async (page, _session, remaining, operationSignal) => {
        await snapshot(page, proposal); // Reject unsupported layouts before installation or execution.
        const sourceUrl = urlSchema.parse(page.url());
        const packageDir = fileURLToPath(new URL('../', import.meta.url));
        const root = fileURLToPath(new URL('../../../', import.meta.url));
        let manifest;
        try {
            manifest = JSON.parse(await readFile(join(packageDir, '.mcp-state.json'), 'utf8'));
            if (typeof manifest.storeDir !== 'string' || !manifest.storeDir) throw new Error('Prepared store path missing');
            if (createHash('sha256').update(await readFile(join(root, 'package.json'))).digest('hex') !== manifest.packageDigest) throw new Error('Root package manifest changed');
            const archive = await readFile(manifest.archive);
            if (createHash('sha256').update(archive).digest('hex') !== manifest.sha256) throw new Error('Archive changed');
            const files = (await readdir(join(root, 'dist'), { recursive: true, withFileTypes: true })).filter(file => file.isFile()).map(file => join(file.parentPath, file.name)).sort();
            const hash = createHash('sha256');
            for (const file of files) { hash.update(relative(join(root, 'dist'), file)); hash.update(await readFile(file)); }
            if (hash.digest('hex') !== manifest.distDigest) throw new Error('Root dist changed');
        } catch { throw new InspectorError('RUNNER_NOT_PREPARED', 'Run pnpm mcp:prepare to build and pack the current library before validation.'); }
        const directory = await mkdtemp(join(tmpdir(), 'pst-mcp-consumer-'));
        const started = Date.now();
        try {
            await copyFile(manifest.archive, join(directory, 'library.tgz'));
            await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: {
                '@rickcedwhat/playwright-smart-table': 'file:./library.tgz', '@playwright/test': manifest.playwright, typescript: manifest.typescript, '@types/node': manifest.nodeTypes,
            } }));
            await writeFile(join(directory, 'config.mts'), generateConfig(proposal));
            await copyFile(join(packageDir, 'consumer/runner.mts'), join(directory, 'runner.mts'));
            await writeFile(join(directory, 'input.json'), JSON.stringify({ url: sourceUrl, budget }));
            await copyFile(manifest.lockfile, join(directory, 'pnpm-lock.yaml'));
            await runProcess('pnpm', ['install', '--store-dir', manifest.storeDir, '--offline', '--frozen-lockfile', '--ignore-scripts', '--config.node-linker=hoisted'], directory, remaining(), operationSignal);
            await runProcess('pnpm', ['exec', 'tsc', 'runner.mts', 'config.mts', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', '--lib', 'ES2022,DOM', '--types', 'node', '--skipLibCheck', '--outDir', 'built'], directory, remaining(), operationSignal);
            await runProcess(process.execPath, ['built/runner.mjs'], directory, remaining(), operationSignal);
            const result = validationResultSchema.parse({ ...JSON.parse(await readFile(join(directory, 'result.json'), 'utf8')),
                runId: randomUUID(), sourceUrl, configExecuted: true, fullDatasetVerified: false, elapsedMs: Date.now() - started,
                library: { version: manifest.version, sha256: manifest.sha256, preparedFromCommit: manifest.preparedFromCommit, playwright: manifest.playwright, typescript: manifest.typescript },
                limitations: ['Executed in a fresh unauthenticated consumer; the original inspection browser is unchanged.', 'Control termination is not dataset completeness. Identity candidates are checked only over visited pages.', 'No oracle was available to the consumer. Independent bench comparison is separate.'] });
            while (Buffer.byteLength(JSON.stringify(successResult(result))) > budget.maxOutputBytes && result.records.length) { result.records.pop(); result.status = 'partial'; result.traversal.termination = 'output-budget'; }
            if (Buffer.byteLength(JSON.stringify(successResult(result))) > budget.maxOutputBytes) throw new InspectorError('OUTPUT_BUDGET', 'Validation metadata exceeds output budget.');
            saveValidation(result);
            return result;
        } finally { await rm(directory, { recursive: true, force: true }); }
    });
}
