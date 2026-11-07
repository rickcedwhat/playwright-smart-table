import { randomUUID } from 'node:crypto';
import { evaluateSubmission } from './evaluate.js';
import type { ValidationResult } from '../workflow-contracts.js';
const runs = new Map<string, { created: number; result: ValidationResult }>();
export function saveValidation(result: ValidationResult) {
    for (const [id, run] of runs) if (Date.now() - run.created > 600000) runs.delete(id);
    if (runs.size >= 100) runs.delete(runs.keys().next().value!);
    runs.set(result.runId, { created: Date.now(), result });
}
/** Only a server-created witness, never arbitrary submitted result JSON, can be scored as execution. */
export function evaluateValidation(runId: string, fixture: string, origin: string) {
    const run = runs.get(runId);
    if (!run || Date.now() - run.created > 600000) throw new Error('Unknown or expired validation run');
    const source = new URL(run.result.sourceUrl);
    if (source.origin !== origin || source.pathname !== '/fixtures/' + fixture || [...source.searchParams.keys()].some(key => key !== 'page')) throw new Error('Validation did not run against this registered fixture');
    const comparison = evaluateSubmission(fixture, { records: run.result.records, claim: 'partial', navigation: [] });
    const executionPassed = run.result.status === 'tested' && Object.values(run.result.checks).every(Boolean);
    const traversalPassed = fixture === 'plain' ? run.result.traversal.termination === 'single-page' : run.result.traversal.termination === 'terminal-control' && run.result.traversal.rewind === 'established';
    return { comparison: 'trusted-consumer-fixture', runId, evaluationId: randomUUID(), oracleVersion: comparison.oracleVersion,
        configValidated: executionPassed && traversalPassed && comparison.dataMatches,
        passes: executionPassed && traversalPassed && comparison.dataMatches,
        dataMatches: comparison.dataMatches, missing: comparison.missing, extra: comparison.extra, repeated: comparison.repeated, wrongValues: comparison.wrongValues,
        scope: 'This exact config execution, packed build and registered fixture only. No universal identity/completeness claim.' };
}
