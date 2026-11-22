import type { Page } from '@playwright/test';
import { z } from 'zod';
import { readGrid } from './grid-dom.js';
import { SessionManager } from './sessions.js';
import { sessionSchema, evidenceSchema, createEvidence } from './contracts.js';
export const virtualObservationSchema = z.object({
    status: z.enum(['observed', 'unknown', 'unsupported']), session: sessionSchema, evidence: evidenceSchema,
    identity: z.enum(['candidate', 'unknown']), mounted: z.number(), visible: z.number(), declared: z.number().nullable(),
    reasons: z.array(z.string()), fullDatasetVerified: z.literal(false), limitations: z.array(z.string()),
}).strict();
export async function gridSnapshot(page: Page, root: string, scroller = root) {
    const locator = page.locator(root);
    if (await locator.count() !== 1) throw new Error('Select exactly one top-level DOM grid. Frames and canvas need separate support.');
    return locator.evaluate(readGrid, { header: '[role="columnheader"]', row: '[role="row"]', cell: '[role="gridcell"]', scroller });
}
export async function inspectVirtualization(sessions: SessionManager, id: string, selector: string | undefined, signal: AbortSignal) {
    return sessions.run(id, 10000, signal, async (page, session, remaining) => {
        const roots = page.locator(selector ?? '[role="grid"]');
        let reasons: string[] = [], mounted = 0, visible = 0, declared: number | null = null, unknown = false, unready = false;
        if (await roots.count() !== 1) reasons = ['Select one top-level DOM grid. Frames, shadow-root tables and canvas-only content are unsupported.'];
        else {
            const candidate = roots;
            let result = await candidate.evaluate(readGrid, { header: '[role="columnheader"]', row: '[role="row"]', cell: '[role="gridcell"]', scroller: selector ?? '[role="grid"]' });
            const until = Date.now() + Math.min(1500, remaining());
            while (!result.ready && Date.now() < until) { await page.waitForTimeout(25); result = await candidate.evaluate(readGrid, { header: '[role="columnheader"]', row: '[role="row"]', cell: '[role="gridcell"]', scroller: selector ?? '[role="grid"]' }); }
            unready = !result.ready;
            reasons = result.issues; mounted = result.entries.length; visible = result.entries.filter(row => row.visible).length;
            declared = Number.isFinite(result.count) ? result.count : null; unknown = result.identityUnknown;
            if (unknown) reasons.push('Identity is unknown: missing/repeated IDs cannot be replaced by visible text or mounted-slot keys.');
            if (!result.ready) reasons.push('Readiness is unverified; do not infer completion from an old mounted window.');
        }
        return virtualObservationSchema.parse({ status: reasons.length ? unknown || unready ? 'unknown' : 'unsupported' : 'observed', session, evidence: createEvidence(session, page.url()), identity: unknown ? 'unknown' : 'candidate', mounted, visible, declared,
            reasons, fullDatasetVerified: false, limitations: ['Read-only mounted window, not proof of recycling or globally stable identity.', 'Vertical DOM grids only. No frame, shadow DOM, canvas or horizontal traversal support.'] });
    });
}
