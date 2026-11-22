import { readFileSync } from 'node:fs';
import { evaluationSubmissionSchema, evaluationResultSchema, recordSchema } from '../contracts.js';
import { fixtureNames } from './fixtures.js';

/** Privileged bench-only comparison. Never register as an MCP tool or serve the oracle file. */
export function evaluateSubmission(fixture: string, raw: unknown) {
    if (!fixtureNames.some(name => name === fixture)) throw new Error('Unknown benchmark fixture');
    const submission = evaluationSubmissionSchema.parse(raw);
    // Independent, manually maintained oracle: not derived from the fixture renderer.
    const manifest = JSON.parse(readFileSync(new URL(`../../tests/bench/${fixture === 'recycling-offscreen' ? 'recycling-offscreen' : fixture.startsWith('recycling') ? 'recycling' : fixture === 'holdout' ? 'inventory' : 'people'}-oracle.json`, import.meta.url), 'utf8'));
    const expected = recordSchema.array().parse(fixture === 'recycling-no-id' ? manifest.records.map(() => ({ id: null, values: { Name: 'Copy', Team: 'Ops' } })) : manifest.records);
    const counts = new Map<string | null, number>();
    for (const record of submission.records) counts.set(record.id, (counts.get(record.id) ?? 0) + 1);
    const expectedCounts = new Map<string | null, number>();
    for (const record of expected) expectedCounts.set(record.id, (expectedCounts.get(record.id) ?? 0) + 1);
    const missing = [...expectedCounts].flatMap(([id, count]) => Array.from({ length: Math.max(0, count - (counts.get(id) ?? 0)) }, () => id));
    const extra = submission.records.filter(record => !expected.some(value => value.id === record.id)).map(record => record.id);
    const repeated = [...counts].filter(([id, count]) => count > Math.max(1, expectedCounts.get(id) ?? 0)).map(([id, count]) => ({ id, count }));
    const wrongValues = submission.records.flatMap(record => {
        const match = expected.find(value => value.id === record.id);
        if (!match) return [];
        const keys = [...new Set([...Object.keys(match.values), ...Object.keys(record.values)])];
        const own = (values: Record<string, string>, key: string) => Object.hasOwn(values, key) ? values[key] : null;
        return keys.filter(key => own(match.values, key) !== own(record.values, key)).map(column => ({ id: record.id, column, expected: own(match.values, column), actual: own(record.values, column) }));
    });
    const ineffectiveNavigation = submission.navigation.flatMap((step, index) => {
        const pageOf = (ids: string[]) => {
            for (let i = 0; i < expected.length; i += 2) if (JSON.stringify(expected.slice(i, i + 2).map(row => row.id)) === JSON.stringify(ids)) return i / 2;
            return -1;
        };
        const before = pageOf(step.beforeIds), after = pageOf(step.afterIds);
        const moved = before >= 0 && after >= 0 && after === before + (step.direction === 'next' ? 1 : -1);
        return step.claimedMoved && (!moved || fixture === 'plain' || (fixture === 'broken-next' && step.direction === 'next')) ? [index] : [];
    });
    const unsupportedClaims = submission.claim === 'complete' ? ['Completeness was asserted without a trusted traversal witness; data matching alone is insufficient.'] : [];
    const dataMatches = !missing.length && !extra.length && !repeated.length && !wrongValues.length;
    return evaluationResultSchema.parse({ comparison: 'submitted-data-only', orderPolicy: manifest.orderPolicy, oracleVersion: manifest.version, dataMatches,
        configValidated: false, missing, extra, repeated, wrongValues, ineffectiveNavigation, unsupportedClaims,
        passes: dataMatches && !ineffectiveNavigation.length && !unsupportedClaims.length });
}
