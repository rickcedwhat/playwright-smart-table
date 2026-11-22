import { InspectorError, successResult, createEvidence } from './contracts.js';
import { SessionManager } from './sessions.js';
import { assertProposalState } from './state.js';
import { gridSnapshot } from './virtualization.js';
import { probeResultSchema, type Proposal, type WorkflowBudget } from './workflow-contracts.js';
export async function probeVirtualization(sessions: SessionManager, id: string, proposal: Proposal, budget: WorkflowBudget, signal: AbortSignal) {
    return sessions.run(id, budget.timeoutMs, signal, async (page, session, remaining) => {
        await assertProposalState(page, id, proposal);
        if (!proposal.virtualization) throw new InspectorError('UNSUPPORTED_STRUCTURE', 'An explicit vertical virtualization proposal is required.');
        const options = proposal.virtualization;
        const read = async () => {
            let value = await gridSnapshot(page, proposal.root, options.scroller);
            const until = Date.now() + Math.min(1500, remaining());
            while (!value.ready && Date.now() < until) { await page.waitForTimeout(25); value = await gridSnapshot(page, proposal.root, options.scroller); }
            return value;
        };
        const initial = await read();
        const packed = (value: typeof initial) => ({ url: value.url, ids: value.entries.map(row => row.id ?? ''), values: value.entries.map(row => row.values), scroll: value.scroll });
        const records = new Map<string, { id: string; values: Record<string, string> }>();
        const positions = new Map<string, number | null>();
        let current = initial, actions = 0, pages = 0;
        let termination = 'scroll-end', restoration: 'restored' | 'failed' | 'not-attempted' = 'not-attempted';
        const reasons: string[] = [];
        while (true) {
            if (!current.ready) { termination = 'readiness-timeout'; break; }
            if (current.identityUnknown) { termination = 'identity-unknown'; break; }
            if (current.issues.length) { termination = 'unsupported'; reasons.push(...current.issues); break; }
            if (current.revision !== initial.revision) { termination = 'state-changed'; break; }
            if (current.entries.some(row => row.id && records.has(row.id) && (positions.get(row.id) !== row.index || JSON.stringify(records.get(row.id)!.values) !== JSON.stringify(row.values)))) { termination = 'state-changed'; break; }
            pages++;
            for (const row of current.entries) if (row.id) { positions.set(row.id, row.index); records.set(row.id, { id: row.id, values: row.values }); }
            if (records.size > budget.maxRows) { termination = 'row-budget'; break; }
            if (current.scroll.top >= current.scroll.maxTop - 1) break;
            if (pages >= budget.maxPages) { termination = 'page-budget'; break; }
            if (actions >= budget.maxActions) { termination = 'action-budget'; break; }
            const before = current.scroll.top;
            actions++;
            await page.locator(options.scroller).evaluate(el => { el.scrollTop += el.clientHeight * 0.8; });
            current = await read();
            if (current.scroll.top <= before) { termination = 'ineffective-control'; break; }
        }
        if (current.scroll.top === initial.scroll.top) restoration = 'restored';
        else if (actions < budget.maxActions && remaining() > 100) {
            actions++;
            await page.locator(options.scroller).evaluate((el, top) => { el.scrollTop = top; }, initial.scroll.top);
            current = await read();
            restoration = current.ready && current.revision === initial.revision && JSON.stringify(packed(current)) === JSON.stringify(packed(initial)) ? 'restored' : 'failed';
        } else restoration = 'failed';
        const evidence = createEvidence(session, page.url());
        const result = probeResultSchema.parse({ status: termination === 'scroll-end' ? restoration === 'restored' ? 'tested' : 'partial' : ['action-budget', 'page-budget', 'row-budget'].includes(termination) ? 'partial' : 'failed',
            session, evidenceId: evidence.id, evidence, records: [...records.values()].slice(0, budget.maxRows), fullDatasetVerified: false,
            traversal: { start: packed(initial), end: packed(current), actions, pages, rewind: 'not-needed', restoration, termination },
            limitations: ['Forward mounted-window probe from current scroll position, not a full-dataset proof.', 'IDs/indices remain candidates; no text or slot fallback. Restoration shares the action/time budget.', ...reasons] });
        while (Buffer.byteLength(JSON.stringify(successResult(result))) > budget.maxOutputBytes && result.records.length) { result.records.pop(); result.status = 'partial'; result.traversal.termination = 'output-budget'; }
        if (Buffer.byteLength(JSON.stringify(successResult(result))) > budget.maxOutputBytes) throw new InspectorError('OUTPUT_BUDGET', 'Grid evidence exceeds output budget.');
        return result;
    });
}
