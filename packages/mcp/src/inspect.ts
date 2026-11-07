import { chromium } from '@playwright/test';
import { z } from 'zod';
import { detectPreset } from './detectors/preset.js';

export const inspectShape = {
    url: z.string().url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an http(s) URL'),
    tableSelector: z.string().trim().min(1).max(1000).optional(),
    timeoutMs: z.number().int().min(100).max(30000).default(10000),
};
const schema = z.object(inspectShape).strict();

/** Baseline observation only: no navigation probes, model calls, or config generation. */
export async function inspectTable(raw: unknown) {
    const input = schema.parse(raw);
    const browser = await chromium.launch({ timeout: input.timeoutMs });
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(input.timeoutMs);
        await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: input.timeoutMs });
        const roots = page.locator(input.tableSelector ?? 'table, [role="grid"], [role="table"]');
        await roots.first().waitFor({ state: 'attached' });
        const count = await roots.count();
        if (count !== 1) throw new Error(`Found ${count} table roots. Supply tableSelector to choose exactly one.`);
        const observed = await roots.evaluate(root => {
            const elements = [root, ...Array.from(root.querySelectorAll('*')).slice(0, 2000)];
            const classes = [...new Set(elements.flatMap(el => [...el.classList]))];
            const rows = [...root.querySelectorAll('tbody tr, [role="row"]')];
            const number = (name: string) => {
                const raw = root.getAttribute(name)?.trim();
                if (!raw) return null;
                const value = Number(raw);
                return Number.isInteger(value) && value >= 0 ? value : null;
            };
            return {
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
                headers: [...root.querySelectorAll('th, [role="columnheader"]')].slice(0, 100).map(el => (el.textContent ?? '').trim().slice(0, 120)),
                sampleRows: rows.slice(0, 3).map(row => (row.textContent ?? '').trim().slice(0, 500)),
                elementSampleTruncated: root.querySelectorAll('*').length > 2000,
            };
        });
        const preset = detectPreset({ ...observed, classes: new Set(observed.classes), roles: new Set(observed.roles), dataAttributes: new Set(observed.dataAttributes) });
        return {
            status: 'observed', url: page.url(),
            tableSelector: input.tableSelector ?? 'table, [role="grid"], [role="table"]',
            headers: observed.headers, mountedRowCount: observed.visibleRowCount,
            sampleRows: observed.sampleRows,
            preset: { ...preset, status: 'hypothesis', scoreMeaning: 'Weighted fraction of legacy fingerprint signals; not a probability or validated preset.' },
            declaredRowCount: observed.ariaRowCount,
            elementSampleTruncated: observed.elementSampleTruncated,
            limitations: ['Only the currently mounted DOM was inspected.', 'Pagination, virtualization, identity, readiness and completeness have not been tested.', 'No config was generated or validated.'],
        };
    } finally {
        await browser.close();
    }
}
