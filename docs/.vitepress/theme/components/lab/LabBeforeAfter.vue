<script setup lang="ts">
import { computed, ref } from 'vue'

type ColKey = 'name' | 'role' | 'office' | 'status' | 'dept'

const labels: Record<ColKey, string> = {
  name: 'Name',
  role: 'Role',
  office: 'Office',
  status: 'Status',
  dept: 'Department'
}

const originalOrder: ColKey[] = ['name', 'role', 'office', 'status', 'dept']

/** Enough rows for aggregate questions (e.g. count) to be meaningful */
const rows: Array<Record<ColKey, string>> = [
  { name: 'Airi Satou', role: 'Accountant', office: 'Tokyo', status: 'Active', dept: 'Finance' },
  { name: 'Bradley Greer', role: 'Engineer', office: 'London', status: 'Active', dept: 'Engineering' },
  { name: 'Cedric Kelly', role: 'Developer', office: 'Edinburgh', status: 'Review', dept: 'Engineering' },
  { name: 'Dana Wade', role: 'Engineer', office: 'London', status: 'Active', dept: 'Engineering' },
  { name: 'Eric Monk', role: 'Engineer', office: 'London', status: 'Review', dept: 'Engineering' },
  { name: 'Fiona Yang', role: 'Designer', office: 'London', status: 'Active', dept: 'Design' },
  { name: 'George Fox', role: 'Engineer', office: 'Paris', status: 'Active', dept: 'Engineering' },
  { name: 'Helen Vance', role: 'Engineer', office: 'London', status: 'Active', dept: 'Sales' }
]

const countEngineerLondonActive = rows.filter(
  (r) => r.role === 'Engineer' && r.office === 'London' && r.status === 'Active'
).length

type BrittlePattern =
  | {
      type: 'filterCell'
      filterIdx: number
      mode: 'includes' | 'equals'
      needle: string
      readIdx: number
    }
  | {
      type: 'filterCellAll'
      filterIdx: number
      mode: 'includes' | 'equals'
      needle: string
      readIdx: number
      join: string
    }
  | {
      type: 'filterCellAnd'
      checks: { idx: number; mode: 'includes' | 'equals'; needle: string }[]
      readIdx: number
    }
  | { type: 'countWhere'; checks: { idx: number; value: string }[] }

type Question = {
  id: string
  prompt: string
  expected: string
  brittle: BrittlePattern
  brittleCode: string
  smartCode: string
  /** “Without Smart Table” pane — why brittle code bites for this scenario */
  blurbWithout: string
  /** “With Smart Table” pane — readability & intent for this scenario */
  blurbWith: string
}

const londonNamesExpected = rows
  .filter((r) => r.office === 'London')
  .map((r) => r.name)
  .join(', ')

/** Locators assume the original layout: 0 Name, 1 Role, 2 Office, 3 Status, 4 Department */
const questions: Question[] = [
  {
    id: 'fiona-office',
    prompt: 'Where does Fiona Yang work?',
    expected: 'London',
    brittle: { type: 'filterCell', filterIdx: 0, mode: 'includes', needle: 'Fiona', readIdx: 2 },
    brittleCode: `page.locator('tbody tr')
  .filter({ has: page.locator('td').nth(0)
    .filter({ hasText: 'Fiona' }) })
  .locator('td').nth(2)
  .textContent()`,
    smartCode: `const row = table.getRow({
  Name: 'Fiona Yang',
});
await row.getCell('Office').textContent();`,
    blurbWithout:
      "Nested locator scoping hunts the row carrying Fiona—then brittle nth(2) still assumes Office lives in that absolute slot.If headers slide, it can scrape a plausible value from somebody else's cell.",
    blurbWith:
      "Name: 'Fiona Yang' states who you're after; getCell('Office') lines up with the question—readable intent versus counting to column two."
  },
  {
    id: 'london-names',
    prompt: 'Which employees are based in London?',
    expected: londonNamesExpected,
    brittle: {
      type: 'filterCellAll',
      filterIdx: 2,
      mode: 'equals',
      needle: 'London',
      readIdx: 0,
      join: ', '
    },
    brittleCode: `const names = [];
for (const tr of await page.locator('tbody tr').all()) {
  const tds = tr.locator('td');
  const office = await tds.nth(2).innerText();
  if (office === 'London') {
    names.push(await tds.nth(0).innerText());
  }
}
return names.join(', ');`,
    smartCode: `const rows = await table.findRows({ Office: 'London' });
const names = await Promise.all(
  rows.map((row) => row.getCell('Name').textContent())
);
return names.join(', ');`,
    blurbWithout:
      'A raw for-loop over tbody tr chains tr.locator/td + brittle nth(2) for Office and nth(0) for Name—indexes desync independently, so pasted-looking names can quietly diverge.',
    blurbWith:
      '`findRows` names the cohort by Office; `rows.map(...)` pulls Name per row with plain column labels—you still rely on Promise.all because each `textContent()` returns a promise, same as any concurrent cell scrape.'
  },
  {
    id: 'airi-role',
    prompt: 'What is Airi Satou\'s role?',
    expected: 'Accountant',
    brittle: { type: 'filterCell', filterIdx: 0, mode: 'includes', needle: 'Airi', readIdx: 1 },
    brittleCode: `page.locator('tbody tr')
  .filter({ has: page.locator('td').nth(0)
    .filter({ hasText: 'Airi' }) })
  .locator('td').nth(1)
  .textContent()`,
    smartCode: `const row = table.getRow({
  Name: 'Airi Satou',
});
await row.getCell('Role').textContent();`,
    blurbWithout:
      "Same pattern as Fiona: narrow to the Name cell with nested filtering, then read Role via brittle nth(1)—one shuffle and 'role' silently points wherever that index landed.",
    blurbWith:
      "Matching question structure: locate Airi Satou, then Role by header—explicit intent versus hoping column one stayed Role forever."
  },
  {
    id: 'review-office',
    prompt: 'Which office is the Developer in Review status based in?',
    expected: 'Edinburgh',
    brittle: {
      type: 'filterCellAnd',
      checks: [
        { idx: 1, mode: 'equals', needle: 'Developer' },
        { idx: 3, mode: 'equals', needle: 'Review' }
      ],
      readIdx: 2
    },
    brittleCode: `page.locator('tbody tr')
  .filter({ has: page.locator('td').nth(1)
    .filter({ hasText: 'Developer' }) })
  .filter({ has: page.locator('td').nth(3)
    .filter({ hasText: 'Review' }) })
  .locator('td').nth(2)
  .textContent()`,
    smartCode: `const row = table.getRow({
  Role: 'Developer',
  Status: 'Review',
});
await row.getCell('Office').textContent();`,
    blurbWithout:
      'One towering chained locator: nested `.filter(({ has:` blocks on nth(1) and nth(3)—hard to skim and brutal to debug. When it fails you re-derive positional intent mid-stack instead of naming the predicates you meant.',
    blurbWith:
      'Crystal-clear intent in two declarative hops: constrain Role + Status, then read Office—reviewers grasp the Cedric-vs-Eric story without reverse-engineering filter depth.'
  },
  {
    id: 'count-eng-lon-active',
    prompt: 'How many Engineers are Active and based in London?',
    expected: String(countEngineerLondonActive),
    brittle: {
      type: 'countWhere',
      checks: [
        { idx: 1, value: 'Engineer' },
        { idx: 2, value: 'London' },
        { idx: 3, value: 'Active' }
      ]
    },
    brittleCode: `let n = 0;
for (const tr of await page.locator('tbody tr').all()) {
  const tds = tr.locator('td');
  const role = await tds.nth(1).innerText();
  const office = await tds.nth(2).innerText();
  const status = await tds.nth(3).innerText();
  if (role === 'Engineer' && office === 'London' && status === 'Active') n++;
}
return n;`,
    smartCode: `const rows = await table.findRows({
  Role: 'Engineer',
  Office: 'London',
  Status: 'Active',
});

return rows.length;`,
    blurbWithout:
      'Another row-by-row crawl: fetch innerText for nth(1), nth(2), nth(3) on every tr praying column order survives release—shuffle once and plausible integers still accumulate from the wrong cells.',
    blurbWith:
      'Declare Engineer + London + Active exactly like reading the sticky header—even with three criteria, writing and scanning findRows predicates stays obvious; length is the tally you asserted without per-row nth accounting.'
  }
]

function evalBrittle(
  pattern: BrittlePattern,
  colOrder: ColKey[],
  orderedDataRows: typeof rows
): string | null {
  const cells = (row: (typeof rows)[number]) => colOrder.map((k) => row[k])

  if (pattern.type === 'filterCell') {
    for (const row of orderedDataRows) {
      const c = cells(row)
      const v = c[pattern.filterIdx] ?? ''
      const ok =
        pattern.mode === 'includes' ? v.includes(pattern.needle) : v === pattern.needle
      if (ok) return c[pattern.readIdx] ?? null
    }
    return null
  }

  if (pattern.type === 'filterCellAll') {
    const parts: string[] = []
    for (const row of orderedDataRows) {
      const c = cells(row)
      const v = c[pattern.filterIdx] ?? ''
      const ok =
        pattern.mode === 'includes' ? v.includes(pattern.needle) : v === pattern.needle
      if (ok) parts.push(c[pattern.readIdx] ?? '')
    }
    return parts.length ? parts.join(pattern.join) : null
  }

  if (pattern.type === 'filterCellAnd') {
    for (const row of orderedDataRows) {
      const c = cells(row)
      const ok = pattern.checks.every((ch) => {
        const v = c[ch.idx] ?? ''
        return ch.mode === 'includes' ? v.includes(ch.needle) : v === ch.needle
      })
      if (ok) return c[pattern.readIdx] ?? null
    }
    return null
  }

  let n = 0
  for (const row of orderedDataRows) {
    const c = cells(row)
    if (pattern.checks.every((ch) => (c[ch.idx] ?? '') === ch.value)) n++
  }
  return String(n)
}

function sameAnswer(a: string | null, expected: string): boolean {
  if (a == null) return false
  return a.trim() === expected.trim()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Wrap ()[]{} outside of tags — VS Code–style brace tint (avoids touching HTML). */
function colorizePunctuation(html: string): string {
  return html.replace(/(<[^>]+>)|([()[\]{}])/g, (_, tag: string | undefined, ch: string | undefined) => {
    if (tag != null) return tag
    return `<span class="tok-brace">${ch}</span>`
  })
}

/**
 * TS/JS-style highlighting aligned with VS Code Dark+ (no extra deps).
 * Order matters: strings → props → flow/decl keywords → calls → identifiers.
 */
function highlightSnippet(source: string): string {
  const strings: string[] = []
  let marked = source.replace(/'([^'\\]|\\.)*'/g, (m) => {
    strings.push(`<span class="tok-str">${escapeHtml(m)}</span>`)
    return `__S${strings.length - 1}__`
  })
  marked = escapeHtml(marked)
  strings.forEach((html, i) => {
    marked = marked.replace(`__S${i}__`, html)
  })
  let s = marked

  s = s.replace(
    /(^|\n)([\t ]*)(Name|Role|Office|Status|Department)(\s*:)/gm,
    '$1$2<span class="tok-prop">$3</span><span class="tok-punct">$4</span>'
  )
  s = s.replace(
    /([\{,]\s*)(has|hasText)(\s*:)/g,
    '$1<span class="tok-prop">$2</span><span class="tok-punct">$3</span>'
  )

  s = s.replace(/\b(async|await|return)\b/g, '<span class="tok-kw-flow">$&</span>')
  s = s.replace(/\b(const|let|for|of|if)\b/g, '<span class="tok-kw">$&</span>')
  s = s.replace(
    /\b(getRow|getCell|findRows|locator|filter|nth|innerText|textContent|all|push|map|join|trim|Promise)\b/g,
    '<span class="tok-fn">$&</span>'
  )
  s = s.replace(/\b(page|table)\b/g, '<span class="tok-root">$&</span>')
  s = s.replace(/\b(true|false)\b/g, '<span class="tok-bool">$&</span>')
  s = s.replace(
    /\b(row|rows|tr|tds|n|names|role|office|status)\b/g,
    '<span class="tok-var">$&</span>'
  )
  s = s.replace(/\b(\d+)\b/g, '<span class="tok-num">$&</span>')

  s = s.replace(/\s*(&&|\|\|)\s*/g, ' <span class="tok-op">$1</span> ')
  return colorizePunctuation(s)
}

const columnOrder = ref<ColKey[]>([...originalOrder])

const selectedId = ref<string>(questions[0]!.id)

const currentQuestion = computed(() => questions.find((q) => q.id === selectedId.value) ?? questions[0]!)

const columnsOk = computed(
  () =>
    columnOrder.value.length === originalOrder.length &&
    columnOrder.value.every((k, i) => k === originalOrder[i])
)

function shuffleColumns() {
  const next = [...columnOrder.value]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  columnOrder.value = next
}

function resetLayout() {
  columnOrder.value = [...originalOrder]
}

const brittleRaw = computed(() =>
  evalBrittle(currentQuestion.value.brittle, columnOrder.value, rows)
)

const brittleOk = computed(() => sameAnswer(brittleRaw.value, currentQuestion.value.expected))

const brittleDisplay = computed(() => {
  const v = brittleRaw.value
  if (v == null || v === '') return '— (no matching cell / row)'
  return v
})

const brittleHighlighted = computed(() => highlightSnippet(currentQuestion.value.brittleCode))
const smartHighlighted = computed(() => highlightSnippet(currentQuestion.value.smartCode))
</script>

<template>
  <div class="lab-ba">
    <div class="intro-block">
      <h3 class="intro-heading">The table answers questions—your locator might not.</h3>
      <p class="intro-sub">
        Real UIs rearrange grids all the time; product questions stay the same—“who sits in Tokyo?”, “how many Engineers pass every filter?”
        In automation it’s tempting to bake in whatever feels stable today, especially <strong>column index</strong> (second cell = Role… until it isn’t).
        Here the <strong>underlying rows and cell values never change</strong>; we’re only scrambling <strong>which column sits where</strong>. We freeze brittle code in place and shuffle anyway—see which approach still resolves the prompts you meant.
      </p>
    </div>

    <div class="lab-grid">
      <div class="grid-q">
        <label class="q-label" for="lab-before-after-q">Question</label>
        <select id="lab-before-after-q" v-model="selectedId" class="q-select">
          <option v-for="q in questions" :key="q.id" :value="q.id">{{ q.prompt }}</option>
        </select>
      </div>

      <div class="grid-tstack">
        <div class="grid-table-ctl">
          <p class="shuffle-note">
            Same underlying table data—employees and values—as on day one; only column <em>ordering</em> changes. Brittle snippets never update; Smart Table stays tied to headers.
          </p>
          <div class="toolbar">
            <button type="button" class="btn-shuffle" @click="shuffleColumns">Shuffle columns</button>
            <button type="button" class="btn-reset" @click="resetLayout">Reset columns</button>
            <span class="tag" :data-on="!columnsOk">{{ columnsOk ? 'Columns: original' : 'Columns: shuffled' }}</span>
            <LabFeedbackMark slug="before-after.shuffle" label="Column shuffle controls" compact />
          </div>
        </div>
        <div class="grid-table demo-table-shell">
          <table class="demo-table" :aria-label="`Employee table — ${currentQuestion.prompt}`">
            <thead>
              <tr>
                <th v-for="key in columnOrder" :key="key">{{ labels[key] }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.name">
                <td v-for="key in columnOrder" :key="key">
                  {{ row[key] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="grid-codes">
        <div class="codes-inner">
          <div class="stack">
            <span class="code-label brittle-label">Brittle (fixed indices)</span>
            <pre class="lab-pre"><code class="lab-code" v-html="brittleHighlighted"></code></pre>
          </div>
          <div class="stack">
            <span class="code-label smart-label">Smart Table</span>
            <pre class="lab-pre"><code class="lab-code" v-html="smartHighlighted"></code></pre>
          </div>
        </div>
      </div>

      <div class="grid-b-ans" aria-live="polite">
        <div class="answer-box" :class="brittleOk ? 'ok' : 'bad'">
          <span class="box-label">Brittle answer</span>
          <span class="box-value">{{ brittleDisplay }}</span>
          <span class="box-foot">{{ brittleOk ? 'Matches the right answer (sometimes luck).' : 'Wrong or meaningless for this question.' }}</span>
        </div>
      </div>

      <div class="grid-s-ans">
        <div class="answer-box ok">
          <span class="box-label">Smart Table answer</span>
          <span class="box-value">{{ currentQuestion.expected }}</span>
          <span class="box-foot">Same answer after reshuffling columns—the data hasn’t changed, only positions.</span>
        </div>
      </div>

      <div class="grid-b-blurb pane pane-bad">
        <strong class="pane-title">
          Without Smart Table
          <LabFeedbackMark slug="before-after.without" label="Without Smart Table" compact />
        </strong>
        <p :key="`${currentQuestion.id}-wo`" class="one-liner">{{ currentQuestion.blurbWithout }}</p>
      </div>

      <div class="grid-s-blurb pane pane-good">
        <strong class="pane-title">
          With Smart Table
          <LabFeedbackMark slug="before-after.with" label="With Smart Table" compact />
        </strong>
        <p :key="`${currentQuestion.id}-wi`" class="one-liner">{{ currentQuestion.blurbWith }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab-ba {
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.lab-grid {
  display: grid;
  /* ~55% cols 1–2 / ~45% cols 3–4 */
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 0.9fr) minmax(0, 0.9fr);
  gap: 14px 20px;
  align-items: stretch;
  grid-template-areas:
    'qhead qhead tstack tstack'
    'codes codes tstack tstack'
    'bans sans tstack tstack'
    'bblur sblur tstack tstack';
}
@media (max-width: 1100px) {
  .lab-grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      'qhead'
      'tstack'
      'codes'
      'bans'
      'sans'
      'bblur'
      'sblur';
  }
  .codes-inner {
    grid-template-columns: 1fr;
  }
}
.grid-q {
  grid-area: qhead;
  min-width: 0;
}
.grid-tstack {
  grid-area: tstack;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  align-self: stretch;
}
.grid-table-ctl {
  min-width: 0;
}
.grid-table-ctl .shuffle-note {
  margin: 0 0 8px;
}
.grid-table-ctl .toolbar {
  margin: 0;
}
.grid-tstack .grid-table {
  min-width: 0;
}
.grid-codes {
  grid-area: codes;
  min-width: 0;
}
.codes-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
  align-items: stretch;
  min-width: 0;
}
.codes-inner .stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  min-height: 0;
  height: 100%;
}
.grid-table {
  min-width: 0;
}
.grid-b-ans {
  grid-area: bans;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.grid-s-ans {
  grid-area: sans;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.grid-b-ans .answer-box,
.grid-s-ans .answer-box {
  flex: 1;
  min-height: 0;
}
.grid-b-blurb {
  grid-area: bblur;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.grid-s-blurb {
  grid-area: sblur;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.grid-b-blurb .one-liner,
.grid-s-blurb .one-liner {
  flex: 1;
  margin-bottom: 0;
}
.intro-block {
  margin-bottom: 2px;
}
.intro-heading {
  margin: 0 0 8px;
  font-size: 1.28rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--vp-c-text-1);
  letter-spacing: -0.02em;
}
.intro-sub {
  margin: 0;
  font-size: 0.88rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
  max-width: 44rem;
}
.intro-sub strong {
  color: var(--vp-c-text-1);
  font-weight: 600;
}
.grid-q .q-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-2);
  margin-bottom: 6px;
}
.q-select {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.86rem;
  line-height: 1.35;
  cursor: pointer;
}
.q-select:hover {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 40%, var(--vp-c-divider));
}
.q-select:focus {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 1px;
}
.shuffle-note {
  margin: 0;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}
.shuffle-note strong {
  color: var(--vp-c-text-1);
  font-weight: 600;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
}
.tag[data-on='true'] {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 45%, var(--vp-c-divider));
  color: var(--vp-c-text-1);
}
.btn-shuffle {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-size: 0.82rem;
  cursor: pointer;
  color: var(--vp-c-text-1);
}
.btn-shuffle:hover {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 45%, var(--vp-c-divider));
}
.btn-reset {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  font-size: 0.78rem;
  cursor: pointer;
  color: var(--vp-c-text-2);
}
.btn-reset:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}
.demo-table-shell {
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--vp-c-divider) 85%, transparent);
  overflow: hidden;
  background: color-mix(in srgb, var(--vp-c-bg-soft) 50%, var(--vp-c-bg));
  box-shadow:
    0 1px 0 color-mix(in srgb, #fff 5%, transparent) inset,
    0 8px 24px color-mix(in srgb, #000 28%, transparent);
}
.demo-table {
  width: 100%;
  min-width: 0;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}
.demo-table th,
.demo-table td {
  border-bottom: 1px solid color-mix(in srgb, var(--vp-c-divider) 70%, transparent);
  padding: 7px 10px;
  text-align: left;
  overflow-wrap: anywhere;
  word-break: break-word;
  hyphens: auto;
}
.demo-table thead th {
  background: color-mix(in srgb, var(--vp-c-bg-soft) 75%, var(--vp-c-bg));
  font-weight: 600;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-2);
  border-bottom: 1px solid color-mix(in srgb, var(--vp-c-divider) 90%, transparent);
}
.demo-table tbody tr:nth-child(even) td {
  background: color-mix(in srgb, var(--vp-c-bg-soft) 40%, transparent);
}
.demo-table tbody tr:hover td {
  background: color-mix(in srgb, var(--vp-c-brand-1) 9%, var(--vp-c-bg-soft));
}
.demo-table tbody tr:last-child td {
  border-bottom: none;
}
.demo-table tbody td {
  color: var(--vp-c-text-1);
  transition: background 0.12s ease;
}
.brittle-label {
  color: #b45309;
}
.smart-label {
  color: var(--vp-c-brand-1);
}
.lab-pre {
  margin: 0;
  padding: 12px 14px;
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 8px;
  border: 1px solid #2d2d2d;
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.68rem;
  line-height: 1.55;
  tab-size: 2;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  overflow: visible;
  flex: 1;
  min-height: 0;
}
.codes-inner .lab-pre code {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: inherit;
}
.lab-code :deep(.tok-kw) {
  color: #569cd6;
  font-weight: 500;
}
.lab-code :deep(.tok-kw-flow) {
  color: #c586c0;
  font-weight: 500;
}
.lab-code :deep(.tok-fn) {
  color: #dcdcaa;
}
.lab-code :deep(.tok-str) {
  color: #ce9178;
}
.lab-code :deep(.tok-root),
.lab-code :deep(.tok-var) {
  color: #9cdcfe;
}
.lab-code :deep(.tok-prop) {
  color: #9cdcfe;
}
.lab-code :deep(.tok-punct) {
  color: #d4d4d4;
}
.lab-code :deep(.tok-brace) {
  color: #da70d6;
}
.lab-code :deep(.tok-bool) {
  color: #569cd6;
}
.lab-code :deep(.tok-num) {
  color: #b5cea8;
}
.lab-code :deep(.tok-op) {
  color: #d4d4d4;
}
.code-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.answer-box {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.answer-box.ok {
  background: color-mix(in srgb, #16a34a 11%, var(--vp-c-bg-soft));
  border-color: #22c55e;
}
.answer-box.bad {
  background: color-mix(in srgb, #dc2626 9%, var(--vp-c-bg-soft));
  border-color: #f87171;
}
.box-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
}
.answer-box.ok .box-label {
  color: #15803d;
}
.answer-box.bad .box-label {
  color: #b91c1c;
}
.box-value {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.box-foot {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  line-height: 1.4;
}
.pane {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}
.pane-bad {
  border-color: color-mix(in srgb, #f87171 30%, var(--vp-c-divider));
}
.pane-good {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 35%, var(--vp-c-divider));
}
strong.pane-title {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 0.88rem;
}
.one-liner {
  margin: 0;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  line-height: 1.45;
}
.one-liner code {
  font-size: 0.85em;
}
</style>
