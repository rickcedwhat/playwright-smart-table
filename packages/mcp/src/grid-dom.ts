/** Serializable DOM reader shared by MCP probes and the installed consumer. No oracle access. */
export function readGrid(root: Element, selectors: { header: string; row: string; cell: string; scroller: string }) {
    const issues: string[] = [];
    const scroller = root.matches(selectors.scroller) ? root as HTMLElement : root.querySelector<HTMLElement>(selectors.scroller);
    const headers = [...root.querySelectorAll(selectors.header)];
    const names = headers.map(el => (el.textContent ?? '').trim());
    const fields = headers.map(el => el.getAttribute('data-field'));
    const rows = [...root.querySelectorAll(selectors.row)];
    const count = root.getAttribute('aria-rowcount')?.trim() ? Number(root.getAttribute('aria-rowcount')) : NaN;
    const columns = root.getAttribute('aria-colcount')?.trim() ? Number(root.getAttribute('aria-colcount')) : NaN;
    if (window.top !== window || root.getRootNode() !== document || root.getAttribute('role') !== 'grid' || root.querySelector('[role="grid"]')) issues.push('Only a top-level single DOM grid is supported.');
    if (!scroller || scroller !== root) issues.push('The grid root must be its own scrolling viewport.');
    if (!Number.isInteger(count) || count < 1 || count > 1000) issues.push('A bounded positive declared row count is required, but is not a completeness oracle.');
    if (!names.length || names.length > 20 || names.some(name => !name || name.length > 120) || new Set(names).size !== names.length || columns !== names.length) issues.push('Duplicate, missing, pinned or unmounted columns are unsupported.');
    if (fields.some(field => !field) || new Set(fields).size !== fields.length || headers.some((el, i) => el.getAttribute('aria-colindex') !== String(i + 1))) issues.push('Header field/index metadata is inconsistent.');
    if (!rows.length || rows.length > 100) issues.push('Expected a bounded mounted row window.');
    const rectangle = scroller?.getBoundingClientRect();
    const entries = rows.slice(0, 100).map(row => {
        const raw = row.getAttribute('data-index');
        const index = raw?.trim() ? Number(raw) : NaN;
        if (!Number.isInteger(index) || index < 0 || index >= count || row.getAttribute('aria-rowindex') !== String(index + 1)) issues.push('Row indices are missing, invalid or contradictory.');
        const cells = [...row.querySelectorAll(selectors.cell)];
        if (cells.length !== names.length || cells.some((cell, i) => cell.getAttribute('data-field') !== fields[i] || cell.getAttribute('aria-colindex') !== String(i + 1))) issues.push('Cell field/index mapping is inconsistent; filler or missing cells cannot be guessed.');
        if (cells.some(cell => (cell.textContent ?? '').length > 500)) issues.push('Cell text exceeds the supported observation limit.');
        const bounds = row.getBoundingClientRect();
        return { id: row.getAttribute('data-id'), index: Number.isInteger(index) ? index : null,
            values: Object.fromEntries(cells.map((cell, i) => [names[i] ?? '', (cell.textContent ?? '').trim()])),
            visible: !!rectangle && bounds.height > 0 && bounds.bottom > rectangle.top && bounds.top < rectangle.bottom, height: bounds.height };
    });
    const ids = entries.map(row => row.id);
    const identityUnknown = ids.some(id => !id || id.length > 200) || new Set(ids).size !== ids.length;
    if (new Set(entries.map(row => row.index)).size !== entries.length) issues.push('Repeated logical indices in one window.');
    if (scroller && (scroller.scrollWidth > scroller.clientWidth + 1 || scroller.scrollLeft !== 0)) issues.push('Horizontal virtualization/scrolling is unsupported; off-screen columns cannot be assumed complete.');
    const revision = root.getAttribute('data-revision');
    if (!revision) issues.push('A dataset revision token is required for this supported workflow.');
    const heights = entries.map(row => row.height);
    const rowHeight = heights[0] ?? 0;
    if (rowHeight < 1 || rowHeight > 200 || heights.some(height => Math.abs(height - rowHeight) > 0.5)) issues.push('Rows must have a consistent measurable height.');
    const scroll = { top: scroller?.scrollTop ?? 0, left: scroller?.scrollLeft ?? 0, maxTop: Math.max(0, (scroller?.scrollHeight ?? 0) - (scroller?.clientHeight ?? 0)), maxLeft: Math.max(0, (scroller?.scrollWidth ?? 0) - (scroller?.clientWidth ?? 0)) };
    return { url: location.href, names, count, revision, rowHeight, entries, scroll,
        ready: root.getAttribute('aria-busy') !== 'true' && entries.some(row => row.visible) && rowHeight > 0 && entries.some(row => row.index === Math.floor(scroll.top / rowHeight)) && entries.some(row => row.index === Math.min(count - 1, Math.ceil((scroll.top + (scroller?.clientHeight ?? 0)) / rowHeight) - 1)), identityUnknown, issues: [...new Set(issues)] };
}
