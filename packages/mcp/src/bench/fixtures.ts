/** Fixture application data, not the evaluator's expected result manifest. */
const people = [
    ['r1', 'Alice', 'Ops'], ['r2', 'Alice', 'Ops'], ['r3', 'Bob', 'Design'],
    ['r4', 'Carol', 'Engineering'], ['r5', 'Dan', 'Ops'], ['r6', 'Eve', 'Design'],
];
export const fixtureNames = ['plain', 'paginated', 'broken-next'] as const;

/** Only the current page's data is sent to the browser; the answer key is never embedded. */
export function fixtureHtml(name: string, requestedPage: unknown): string | undefined {
    if (!fixtureNames.some(value => value === name)) return undefined;
    const page = name === 'plain' ? 0 : Math.max(0, Math.min(2, Math.trunc(Number(requestedPage) || 0)));
    const records = name === 'plain' ? people : people.slice(page * 2, page * 2 + 2);
    const next = name === 'broken-next' ? '' : `onclick="location.href='?page=${page + 1}'"`;
    return `<!doctype html><html><head><title>Table fixture</title></head><body>
<h1>People</h1><table id="people"><thead><tr><th>Name</th><th>Team</th></tr></thead><tbody>
${records.map(([id, name, team]) => `<tr data-id="${id}"><td>${name}</td><td>${team}</td></tr>`).join('')}
</tbody></table>${name === 'plain' ? '' : `<output id="position">Page ${page + 1} of 3</output>
<button id="previous" ${page === 0 ? 'disabled' : ''} onclick="location.href='?page=${page - 1}'">Previous</button>
<button id="next" ${page === 2 ? 'disabled' : ''} ${next}>Next</button>`}
</body></html>`;
}
