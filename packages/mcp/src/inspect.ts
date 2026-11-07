import { randomUUID } from 'node:crypto';
import { detectPreset } from './detectors/preset.js';
import { observationSchema, successResult, InspectorError, type Budget } from './contracts.js';
import { SessionManager } from './sessions.js';

/** Observations are historical evidence, superseded by the next revision, never traversal proof. */
export async function inspectTable(sessions: SessionManager, id: string, tableSelector: string | undefined, budget: Budget, signal: AbortSignal) {
    return sessions.run(id, budget.timeoutMs, signal, async (page, session, remaining) => {
        const roots = page.locator(tableSelector ?? 'table, [role="grid"], [role="table"]');
        await roots.first().waitFor({ state: 'attached', timeout: remaining() });
        const count = await roots.count();
        if (count !== 1) throw new Error(`Found ${count} table roots. Supply tableSelector to choose exactly one.`);
        const observed = await roots.evaluate((root, { maxRows, maxChars }) => {
            const elements = [root, ...Array.from(root.querySelectorAll('*')).slice(0, 2000)];
            const classes = [...new Set(elements.flatMap(el => [...el.classList]))];
            const rows = [...root.querySelectorAll('tbody tr, [role="row"]')].filter(row => row.querySelector('td, [role="gridcell"], [role="cell"]'));
            const rawHeaders = [...root.querySelectorAll('thead th, [role="columnheader"]')];
            let textTruncated = rawHeaders.length > 100;
            const headers = rawHeaders.slice(0, 100).map(el => {
                const text = (el.textContent ?? '').trim();
                if (text.length > 120) textTruncated = true;
                return text.slice(0, 120);
            });
            let layoutUnsupported = !!root.querySelector('[colspan]:not([colspan="1"]), [rowspan]:not([rowspan="1"])') || new Set(headers).size !== headers.length || headers.length === 0;
            const records = [];
            let chars = 0;
            for (const row of rows.slice(0, maxRows)) {
                const cells = [...row.querySelectorAll('td, [role="gridcell"], [role="cell"]')].slice(0, 101);
                if (cells.length !== headers.length) layoutUnsupported = true;
                if (cells.some((cell, index) => ['aria-colindex', 'data-field'].some(attribute => {
                    const headerValue = rawHeaders[index]?.getAttribute(attribute) ?? null;
                    const cellValue = cell.getAttribute(attribute);
                    return (headerValue !== null || cellValue !== null) && headerValue !== cellValue;
                }))) layoutUnsupported = true;
                const id = row.getAttribute('data-id');
                if (id && id.length > 200) textTruncated = true;
                const record = { id: id?.slice(0, 200) ?? null, values: Object.fromEntries(cells.map((cell, index) => {
                    const text = (cell.textContent ?? '').trim();
                    if (text.length > 500) textTruncated = true;
                    return [headers[index] ?? '', text.slice(0, 500)];
                })) };
                records.push(record); chars += JSON.stringify(record).length;
                if (chars > maxChars) break;
            }
            const number = (name: string) => {
                const raw = root.getAttribute(name)?.trim();
                if (!raw) return null;
                const value = Number(raw);
                return Number.isInteger(value) && value >= 0 ? value : null;
            };
            return {
                sourceUrl: location.href,
                classes,
                roles: [...new Set(elements.flatMap(el => el.getAttribute('role') ? [el.getAttribute('role')!] : []))],
                dataAttributes: [...new Set(elements.flatMap(el => el.getAttributeNames().filter(name => /^(data-|aria-)/.test(name))))],
                hasGlideCanvas: elements.some(el => [...el.classList].some(c => c.startsWith('dvn-')) && !!el.querySelector('canvas')),
                hasGlideInput: !!root.querySelector('textarea[class*="gdg-"]'),
                hasGlideClass: classes.some(c => /^(dvn-|gdg-)/.test(c)),
                visibleRowCount: rows.length, // Legacy detector field; this is mounted, not viewport-visible.
                ariaRowCount: number('aria-rowcount'), ariaColCount: number('aria-colcount'),
                styles: { transform: elements.map(el => (el as HTMLElement).style?.transform ?? '').filter(Boolean) },
                paginationTexts: [], paginationButtons: [],
                headers, records: layoutUnsupported ? [] : records, layoutUnsupported, textTruncated,
                elementSampleTruncated: root.querySelectorAll('*').length > 2000,
            };
        }, { maxRows: budget.maxRows, maxChars: budget.maxOutputBytes });
        const preset = detectPreset({ ...observed, classes: new Set(observed.classes), roles: new Set(observed.roles), dataAttributes: new Set(observed.dataAttributes) });
        const evidence = { id: randomUUID(), kind: 'dom-snapshot' as const, observedAt: new Date().toISOString(), sessionId: session.id, revision: session.revision, url: observed.sourceUrl };
        const result = observationSchema.parse({
            status: 'observed', session: { ...session, url: observed.sourceUrl }, evidence,
            headers: observed.headers, mountedRowCount: observed.visibleRowCount, records: observed.records,
            preset: { ...preset, subject: 'preset', scope: 'Current mounted DOM only', status: 'hypothesis', evidenceIds: [evidence.id], limitations: ['No preset config has been executed.'], scoreMeaning: 'Weighted legacy fingerprint score, not a calibrated probability.' },
            declaredRowCount: observed.ariaRowCount,
            coverage: { scope: 'mounted-only', fullDatasetVerified: false, truncated: observed.visibleRowCount > observed.records.length || observed.elementSampleTruncated || observed.textTruncated, layoutUnsupported: observed.layoutUnsupported },
            limitations: ['Only mounted DOM was observed; identity, pagination, readiness and completeness are unverified.', 'Record IDs are attribute candidates, not proven globally unique.', 'Column values use DOM position; no extraction config has been validated.', ...(observed.layoutUnsupported ? ['Column layout is ambiguous or inconsistent; records were withheld.'] : []), 'No config was executed.'],
        });
        if (Buffer.byteLength(JSON.stringify(successResult(result))) > budget.maxOutputBytes) {
            const records = result.records;
            result.coverage.truncated = true;
            let low = 0, high = records.length;
            while (low < high) {
                const middle = Math.ceil((low + high) / 2);
                result.records = records.slice(0, middle);
                if (Buffer.byteLength(JSON.stringify(successResult(result))) <= budget.maxOutputBytes) low = middle;
                else high = middle - 1;
            }
            result.records = records.slice(0, low);
        }
        if (Buffer.byteLength(JSON.stringify(successResult(result))) > budget.maxOutputBytes) throw new InspectorError('OUTPUT_BUDGET', 'Metadata exceeds the output budget. Increase maxOutputBytes.');
        return result;
    });
}
