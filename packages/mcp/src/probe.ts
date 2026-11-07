import { randomUUID } from 'node:crypto';
import { SessionManager } from './sessions.js';
import { probeResultSchema, type Proposal, type WorkflowBudget } from './workflow-contracts.js';
import { snapshot, checkControl } from './navigation.js';
import { successResult, InspectorError } from './contracts.js';

export async function probePagination(sessions: SessionManager, id: string, proposal: Proposal, budget: WorkflowBudget, signal: AbortSignal) {
    return sessions.run(id, budget.timeoutMs, signal, async (page, session, remaining) => {
        const start = await snapshot(page, proposal);
        let end = start, actions = 0;
        const records = start.ids.map((id, index) => ({ id, values: start.values[index] }));
        let termination: 'single-page' | 'terminal-control' | 'action-budget' | 'page-budget' | 'row-budget' | 'ineffective-control' | 'cycle' = 'single-page';
        let pages = 1;
        let restoration: 'restored' | 'failed' | 'not-attempted' = 'not-attempted';
        const seen = new Set([JSON.stringify(start.ids)]);
        if (proposal.pagination) {
            while (true) {
                const next = await checkControl(page, proposal.pagination.next, 'next');
                if (await next.isDisabled()) { termination = 'terminal-control'; break; }
                if (actions >= budget.maxActions) { termination = 'action-budget'; break; }
                if (pages >= budget.maxPages) { termination = 'page-budget'; break; }
                if (records.length >= budget.maxRows) { termination = 'row-budget'; break; }
                const before = JSON.stringify(end.ids.map((id, i) => [id, end.values[i]]));
                actions++;
                await next.click({ timeout: remaining() });
                const waitEnd = Date.now() + Math.min(1000, remaining());
                do {
                    end = await snapshot(page, proposal);
                    if (JSON.stringify(end.ids.map((id, i) => [id, end.values[i]])) !== before) break;
                    await page.waitForTimeout(Math.min(25, remaining()));
                } while (Date.now() < waitEnd);
                if (JSON.stringify(end.ids.map((id, i) => [id, end.values[i]])) === before) { termination = 'ineffective-control'; break; }
                const key = JSON.stringify(end.ids);
                if (seen.has(key) || end.ids.some(id => records.some(row => row.id === id))) { termination = 'cycle'; break; }
                seen.add(key); pages++;
                records.push(...end.ids.map((id, i) => ({ id, values: end.values[i] })));
            }
            // Restore by explicit reverse controls, never by guessing a URL or reloading.
            if (JSON.stringify(end) === JSON.stringify(start)) restoration = 'restored';
            else {
                while (actions < budget.maxActions) {
                    const previous = await checkControl(page, proposal.pagination.previous, 'previous');
                    if (await previous.isDisabled()) break;
                    actions++; await previous.click({ timeout: remaining() });
                    const deadline = Date.now() + Math.min(1000, remaining());
                    const before = JSON.stringify(end);
                    do { end = await snapshot(page, proposal); if (JSON.stringify(end) !== before) break; await page.waitForTimeout(25); } while (Date.now() < deadline);
                    if (JSON.stringify(end.ids) === JSON.stringify(start.ids) && JSON.stringify(end.values) === JSON.stringify(start.values)) { restoration = 'restored'; break; }
                    if (JSON.stringify(end) === before) break;
                }
                if (restoration !== 'restored') restoration = 'failed';
            }
        }
        if (records.length > budget.maxRows) { records.length = budget.maxRows; termination = 'row-budget'; }
        const result = probeResultSchema.parse({ status: ['single-page', 'terminal-control'].includes(termination) ? restoration === 'failed' ? 'partial' : 'tested' : termination === 'ineffective-control' || termination === 'cycle' ? 'failed' : 'partial',
            session: { ...session, url: page.url() }, evidenceId: randomUUID(), records,
            traversal: { start, end, actions, pages, rewind: 'not-needed', restoration, termination }, fullDatasetVerified: false,
            limitations: ['Forward scan starts at the current page; no first-page claim.', 'Restoration consumes the same action/time budget. No config was executed.', 'A disabled control and sampled IDs do not establish dataset completeness.'] });
        while (Buffer.byteLength(JSON.stringify(successResult(result))) > budget.maxOutputBytes && result.records.length) { result.records.pop(); result.status = 'partial'; result.traversal.termination = 'output-budget'; }
        if (Buffer.byteLength(JSON.stringify(successResult(result))) > budget.maxOutputBytes) throw new InspectorError('OUTPUT_BUDGET', 'Probe metadata exceeds output budget.');
        return result;
    });
}
