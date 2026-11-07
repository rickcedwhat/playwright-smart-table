import { describe, it, expect } from 'vitest';
import { proposalSchema, workflowBudgetSchema } from '../../src/workflow-contracts.js';
import { generateConfig } from '../../src/generate.js';
import { evaluateValidation } from '../../src/bench/witness.js';

describe('workflow constraints', () => {
    const proposal = { root: '#people', header: 'thead th', row: 'tbody tr', cell: 'td', idAttribute: 'data-id' as const };
    it('rejects arbitrary code, unknown strategies, unbounded budgets and unsupported identity fields', () => {
        for (const value of [{ ...proposal, code: 'process.exit()' }, { ...proposal, idAttribute: 'onclick' }, { ...proposal, pagination: { next: '#next' } }]) expect(() => proposalSchema.parse(value)).toThrow();
        for (const value of [{ maxActions: 31 }, { maxPages: 11 }, { timeoutMs: 120001 }, { maxRows: 1001 }]) expect(() => workflowBudgetSchema.parse(value)).toThrow();
    });
    it('inserts selectors only as JSON literals in trusted templates', () => {
        const root = '#evil"; process.exit(); //';
        const source = generateConfig({ ...proposal, root });
        expect(source).toContain(JSON.stringify(root));
        expect(source).toContain('Strategies');
        expect(source).not.toContain('eval(');
    });
    it('cannot upgrade an arbitrary submitted result into trusted execution', () => {
        expect(() => evaluateValidation('invented', 'plain', 'http://localhost')).toThrow(/Unknown/);
    });
});
