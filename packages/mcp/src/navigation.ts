import type { Page } from '@playwright/test';
import { InspectorError } from './contracts.js';
import type { Proposal } from './workflow-contracts.js';

export async function snapshot(page: Page, proposal: Proposal) {
    const root = page.locator(proposal.root);
    if (await root.count() !== 1) throw new InspectorError('UNSUPPORTED_STRUCTURE', 'Root must match exactly once.');
    return root.evaluate((root, proposal) => {
        const headers = [...root.querySelectorAll(proposal.header)].map(el => (el.textContent ?? '').trim());
        const rows = [...root.querySelectorAll(proposal.row)];
        if (root.tagName !== 'TABLE' || root.querySelector('table') || root.hasAttribute('aria-rowcount') || root.querySelector('[colspan]:not([colspan="1"]), [rowspan]:not([rowspan="1"])') ||
            !headers.length || headers.some(value => !value || value.length > 120) || new Set(headers).size !== headers.length || rows.length > 1000) throw new Error('Unsupported table layout');
        const ids = rows.map(row => row.getAttribute(proposal.idAttribute) ?? '');
        if (ids.some(id => !id || id.length > 200) || new Set(ids).size !== ids.length) throw new Error('Missing or repeated identity candidates');
        const values = rows.map(row => {
            const cells = [...row.querySelectorAll(proposal.cell)];
            if (cells.length !== headers.length || cells.some(cell => (cell.textContent ?? '').length > 1000)) throw new Error('Unsupported column layout or oversized cell');
            return Object.fromEntries(cells.map((cell, index) => [headers[index], (cell.textContent ?? '').trim()]));
        });
        return { url: location.href, ids, values };
    }, proposal);
}
export async function checkControl(page: Page, selector: string, name: string) {
    const control = page.locator(selector);
    if (await control.count() !== 1 || !await control.isVisible()) throw new InspectorError('UNSUPPORTED_CONTROL', 'Control must match one visible native button.');
    const safe = await control.evaluate((el, name) => el.tagName === 'BUTTON' && !(el as HTMLButtonElement).form &&
        (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().toLowerCase() === name, name);
    if (!safe) throw new InspectorError('UNSUPPORTED_CONTROL', 'Only explicitly selected Next/Previous native buttons outside forms are allowed.');
    return control;
}
