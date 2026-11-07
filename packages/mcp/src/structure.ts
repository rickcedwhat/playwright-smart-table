import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { InspectorError } from './contracts.js';
import { proposalResultSchema, type Proposal } from './workflow-contracts.js';
import { generateConfig } from './generate.js';
import { SessionManager } from './sessions.js';

/** Native, flat HTML only. Observed selectors are proposals, not working configs. */
async function describeStructure(page: Page, selector?: string) {
    const roots = page.locator(selector ?? 'table, [role="grid"], [role="table"]');
    if (await roots.count() !== 1) throw new InspectorError('UNSUPPORTED_STRUCTURE', 'Choose exactly one table root.');
    const result = await roots.evaluate(root => {
        const unique = (element: Element) => element.id && document.querySelectorAll('#' + CSS.escape(element.id)).length === 1 ? '#' + CSS.escape(element.id) : null;
        const rows = [...root.querySelectorAll('tbody tr')];
        const headers = [...root.querySelectorAll('thead th')].map(el => (el.textContent ?? '').trim());
        const ids = rows.map(row => row.getAttribute('data-id'));
        const unsupported = root.tagName !== 'TABLE' || !!root.querySelector('table') || !!root.querySelector('[colspan]:not([colspan="1"]), [rowspan]:not([rowspan="1"])') ||
            headers.length === 0 || headers.some(value => !value) || new Set(headers).size !== headers.length || !rows.length ||
            rows.some(row => row.querySelectorAll('td').length !== headers.length) ||
            ids.some(id => !id || id.length > 200) || new Set(ids).size !== ids.length ||
            root.hasAttribute('aria-rowcount');
        const buttons = [...document.querySelectorAll('button')];
        const controls = (name: string) => buttons.filter(el => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().toLowerCase() === name);
        const next = controls('next'), previous = controls('previous');
        const hasControls = next.length > 0 || previous.length > 0;
        return { unsupported, root: unique(root) ?? (document.querySelectorAll('table').length === 1 ? 'table' : null),
            hasControls, next: next.length === 1 ? unique(next[0]) : null, previous: previous.length === 1 ? unique(previous[0]) : null };
    });
    if (result.unsupported || !result.root) throw new InspectorError('UNSUPPORTED_STRUCTURE', 'Only nonempty, flat native tables with unique headers and nonempty page-unique data-id attributes are supported. Virtualization, spans and ambiguous identity need further investigation.');
    if (result.hasControls && (!result.next || !result.previous)) throw new InspectorError('UNSUPPORTED_PAGINATION', 'Automatic proposals require unique Next and Previous native buttons with unique IDs. Supply a bounded proposal explicitly to investigate other selectors.');
    return { root: result.root, header: 'thead th', row: 'tbody tr', cell: 'td', idAttribute: 'data-id',
        ...(result.hasControls ? { pagination: { next: result.next!, previous: result.previous! } } : {}) } satisfies Proposal;
}

export async function proposeConfig(sessions: SessionManager, id: string, selector: string | undefined, signal: AbortSignal) {
    return sessions.run(id, 10000, signal, async (page, session) => {
        const proposal = await describeStructure(page, selector);
        return proposalResultSchema.parse({ status: 'proposed', session: { ...session, url: page.url() }, evidenceId: randomUUID(), proposal, code: generateConfig(proposal),
            limitations: ['Selectors and data-id are hypotheses scoped to this revision. No config has run.', 'Native flat tables and explicit Next/Previous buttons only. No auth inheritance or virtualization support.', 'Absence of recognized controls is not proof that the table is unpaginated.'] });
    });
}
