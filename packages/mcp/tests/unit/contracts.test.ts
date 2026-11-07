import { describe, it, expect } from 'vitest';
import { budgetSchema, findingSchema, evaluationSubmissionSchema, urlSchema } from '../../src/contracts.js';

describe('milestone 1 contracts', () => {
    it('defaults to one read-only page and rejects action/code execution requests', () => {
        expect(budgetSchema.parse({})).toEqual({ timeoutMs: 10000, maxRows: 100, maxOutputBytes: 32768, maxActions: 0, maxPages: 1 });
        for (const invalid of [{ maxActions: 1 }, { maxPages: 2 }, { timeoutMs: 0 }, { maxRows: 1001 }, { maxOutputBytes: 100000 }, { code: 'process.exit()' }]) {
            expect(() => budgetSchema.parse(invalid)).toThrow();
        }
        expect(() => evaluationSubmissionSchema.parse({ records: [], claim: 'complete', navigation: [], code: 'arbitrary code' })).toThrow();
    });
    it('requires a scope and evidence references for findings', () => {
        const valid = { subject: 'pagination', status: 'tested', scope: 'mounted', evidenceIds: ['00000000-0000-4000-8000-000000000000'], limitations: [] };
        expect(findingSchema.parse(valid)).toEqual(valid);
        expect(() => findingSchema.parse({ ...valid, scope: '' })).toThrow();
        expect(() => findingSchema.parse({ ...valid, evidenceIds: [] })).toThrow();
    });
    it('does not accept file URLs or embedded credentials', () => {
        expect(() => urlSchema.parse('file:///etc/passwd')).toThrow();
        expect(() => urlSchema.parse('http://user:secret@localhost')).toThrow();
    });
});
