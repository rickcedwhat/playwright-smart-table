import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { evaluateSubmission } from '../../src/bench/evaluate.js';

const expected = JSON.parse(readFileSync(new URL('../bench/people-oracle.json', import.meta.url), 'utf8')).records;
const submit = (records = expected, claim = 'partial', navigation: unknown[] = []) => ({ records, claim, navigation });
it('accepts exact occurrence/value data without claiming config validation', () => {
    const result = evaluateSubmission('plain', submit());
    expect(result.passes).toBe(true);
    expect(result.configValidated).toBe(false);
});
it('detects collapsed valid duplicates even when their visible values are identical', () => {
    expect(expected[0].values).toEqual(expected[1].values);
    expect(evaluateSubmission('plain', submit(expected.filter((_: unknown, i: number) => i !== 1))).missing).toEqual(['r2']);
});
it('detects extra records, repeated sightings, missing data and wrong column values', () => {
    const records = structuredClone(expected);
    records[0].values.Team = 'Wrong';
    records.pop(); records.push(records[1], { id: 'unknown', values: {} });
    const result = evaluateSubmission('plain', submit(records));
    expect(result.missing).toEqual(['r6']); expect(result.extra).toEqual(['unknown']);
    expect(result.repeated).toEqual([{ id: 'r2', count: 2 }]);
    expect(result.wrongValues).toEqual([{ id: 'r1', column: 'Team', expected: 'Ops', actual: 'Wrong' }]);
});
it('does not accept matching data as a completeness/traversal witness', () => {
    const result = evaluateSubmission('plain', submit(expected, 'complete'));
    expect(result.dataMatches).toBe(true); expect(result.passes).toBe(false);
    expect(result.unsupportedClaims).toHaveLength(1);
});
it('detects ineffective Next claims and contradictions of the broken fixture', () => {
    const navigation = [{ beforeIds: ['r1', 'r2'], afterIds: ['r1', 'r2'], claimedMoved: true }];
    expect(evaluateSubmission('paginated', submit(expected, 'partial', navigation)).ineffectiveNavigation).toEqual([0]);
    navigation[0].afterIds = ['r3', 'r4'];
    expect(evaluateSubmission('broken-next', submit(expected, 'partial', navigation)).ineffectiveNavigation).toEqual([0]);
});

it('explicitly scores membership and values rather than ordering', () => {
    const result = evaluateSubmission('plain', submit([...expected].reverse()));
    expect(result.orderPolicy).toBe('ignore'); expect(result.dataMatches).toBe(true);
});
it('handles prototype-like own column names as data rather than inherited functions', () => {
    const records = structuredClone(expected);
    records[0].values.toString = 'custom';
    expect(evaluateSubmission('plain', submit(records)).wrongValues).toContainEqual({ id: 'r1', column: 'toString', expected: null, actual: 'custom' });
});
it('distinguishes working Previous from broken Next on the broken fixture', () => {
    const step = { direction: 'previous', beforeIds: ['r3', 'r4'], afterIds: ['r1', 'r2'], claimedMoved: true };
    expect(evaluateSubmission('broken-next', submit(expected, 'partial', [step])).ineffectiveNavigation).toEqual([]);
    expect(evaluateSubmission('paginated', submit(expected, 'partial', [{ ...step, direction: 'next' }])).ineffectiveNavigation).toEqual([0]);
});
