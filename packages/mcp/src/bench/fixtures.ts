/** Fixture application data, not the evaluator's expected result manifest. */
const people = [
    ['r1', 'Alice', 'Ops'], ['r2', 'Alice', 'Ops'], ['r3', 'Bob', 'Design'],
    ['r4', 'Carol', 'Engineering'], ['r5', 'Dan', 'Ops'], ['r6', 'Eve', 'Design'],
];
export const fixtureNames = ['plain', 'paginated', 'broken-next', 'holdout'] as const;

/** Only the current page's data is sent to the browser; the answer key is never embedded. */
export function fixtureHtml(name: string, requestedPage: unknown): string | undefined {
    if (!fixtureNames.some(value => value === name)) return undefined;
    const dataset = name === 'holdout' ? [['h101', 'Bolt', 'Warehouse'], ['h102', 'Bolt', 'Warehouse'], ['h103', 'Nut', 'Hardware'], ['h104', 'Washer', 'Hardware']] : people;
    const pages = Math.ceil(dataset.length / 2);
    const tableId = name === 'holdout' ? 'inventory' : 'people';
    const nextId = name === 'holdout' ? 'forward' : 'next';
    const previousId = name === 'holdout' ? 'back' : 'previous';
    const headers = name === 'holdout' ? ['Item', 'Dept'] : ['Name', 'Team'];
    const page = name === 'plain' ? 0 : Math.max(0, Math.min(pages - 1, Math.trunc(Number(requestedPage) || 0)));
    const records = name === 'plain' ? dataset : dataset.slice(page * 2, page * 2 + 2);
    const next = name === 'broken-next' ? '' : `onclick="location.href='?page=${page + 1}'"`;
    return `<!doctype html><html><head><title>Table fixture</title></head><body>
<h1>People</h1><table id="${tableId}"><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>
${records.map(([id, name, team]) => `<tr data-id="${id}"><td>${name}</td><td>${team}</td></tr>`).join('')}
</tbody></table>${name === 'plain' ? '' : `<output id="position">Page ${page + 1} of ${pages}</output>
<button id="${previousId}" ${page === 0 ? 'disabled' : ''} onclick="location.href='?page=${page - 1}'">Previous</button>
<button id="${nextId}" ${page === pages - 1 ? 'disabled' : ''} ${next}>Next</button>`}
</body></html>`;
}
