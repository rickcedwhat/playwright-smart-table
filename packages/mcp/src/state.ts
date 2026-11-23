import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import { InspectorError } from './contracts.js';
import type { Proposal } from './workflow-contracts.js';
export async function stateFingerprint(page: Page, selector: string) {
    const root = page.locator(selector);
    if (await root.count() !== 1) throw new InspectorError('STALE_EVIDENCE', 'The proposed root is no longer unique. Reinspect and repropose.');
    const markup = await root.evaluate(el => JSON.stringify([el.outerHTML, el.scrollTop, el.scrollLeft]));
    if (Buffer.byteLength(markup) > 131072) throw new InspectorError('UNSUPPORTED_STATE', 'Root state exceeds the bounded fingerprint limit.');
    return createHash('sha256').update(markup).digest('hex');
}
export async function assertProposalState(page: Page, id: string, proposal: Proposal) {
    if (!proposal.expectedState) return;
    if (proposal.expectedState.sessionId !== id || proposal.expectedState.fingerprint !== await stateFingerprint(page, proposal.root)) throw new InspectorError('STALE_EVIDENCE', 'Table state changed since the proposal. Reinspect and repropose; old evidence is historical.');
}
