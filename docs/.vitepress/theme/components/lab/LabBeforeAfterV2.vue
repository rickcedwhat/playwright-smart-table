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
  | { type: 'filterCell'; filterIdx: number; mode: 'includes' | 'equals'; needle: string; readIdx: number }
  | { type: 'filterCellAll'; filterIdx: number; mode: 'includes' | 'equals'; needle: string; readIdx: number; join: string }
  | { type: 'filterCellAnd'; checks: { idx: number; mode: 'includes' | 'equals'; needle: string }[]; readIdx: number }
  | { type: 'countWhere'; checks: { idx: number; value: string }[] }

type Question = {
  id: string
  prompt: string
  expected: string
  brittle: BrittlePattern
  brittleCode: string
  smartCode: string
}

const londonNamesExpected = rows.filter((r) => r.office === 'London').map((r) => r.name).join(', ')

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
    smartCode: `const row = table.getRow({ Name: 'Fiona Yang' })
await row.getCell('Office').textContent()`
  },
  {
    id: 'london-names',
    prompt: 'Which employees are based in London?',
    expected: londonNamesExpected,
    brittle: { type: 'filterCellAll', filterIdx: 2, mode: 'equals', needle: 'London', readIdx: 0, join: ', ' },
    brittleCode: `const names = []
for (const tr of await page.locator('tbody tr').all()) {
  const tds = tr.locator('td')
  if (await tds.nth(2).innerText() === 'London')
    names.push(await tds.nth(0).innerText())
}
return names.join(', ')`,
    smartCode: `const rows = await table.findRows({ Office: 'London' })
const names = await Promise.all(
  rows.map((row) => row.getCell('Name').textContent())
)
return names.join(', ')`
  },
  {
    id: 'airi-role',
    prompt: "What is Airi Satou's role?",
    expected: 'Accountant',
    brittle: { type: 'filterCell', filterIdx: 0, mode: 'includes', needle: 'Airi', readIdx: 1 },
    brittleCode: `page.locator('tbody tr')
  .filter({ has: page.locator('td').nth(0)
    .filter({ hasText: 'Airi' }) })
  .locator('td').nth(1)
  .textContent()`,
    smartCode: `const row = table.getRow({ Name: 'Airi Satou' })
await row.getCell('Role').textContent()`
  },
  {
    id: 'review-office',
    prompt: 'Which office is the Developer in Review based in?',
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
})
await row.getCell('Office').textContent()`
  },
  {
    id: 'count-eng-lon-active',
    prompt: 'How many Engineers are Active and in London?',
    expected: String(countEngineerLondonActive),
    brittle: {
      type: 'countWhere',
      checks: [
        { idx: 1, value: 'Engineer' },
        { idx: 2, value: 'London' },
        { idx: 3, value: 'Active' }
      ]
    },
    brittleCode: `let n = 0
for (const tr of await page.locator('tbody tr').all()) {
  const tds = tr.locator('td')
  const role = await tds.nth(1).innerText()
  const office = await tds.nth(2).innerText()
  const status = await tds.nth(3).innerText()
  if (role === 'Engineer' && office === 'London'
    && status === 'Active') n++
}
return n`,
    smartCode: `const rows = await table.findRows({
  Role: 'Engineer',
  Office: 'London',
  Status: 'Active',
})
return rows.length`
  }
]

function evalBrittle(pattern: BrittlePattern, colOrder: ColKey[]): string | null {
  const cells = (row: (typeof rows)[number]) => colOrder.map((k) => row[k])

  if (pattern.type === 'filterCell') {
    for (const row of rows) {
      const c = cells(row)
      const v = c[pattern.filterIdx] ?? ''
      const ok = pattern.mode === 'includes' ? v.includes(pattern.needle) : v === pattern.needle
      if (ok) return c[pattern.readIdx] ?? null
    }
    return null
  }
  if (pattern.type === 'filterCellAll') {
    const parts: string[] = []
    for (const row of rows) {
      const c = cells(row)
      const v = c[pattern.filterIdx] ?? ''
      if (pattern.mode === 'includes' ? v.includes(pattern.needle) : v === pattern.needle)
        parts.push(c[pattern.readIdx] ?? '')
    }
    return parts.length ? parts.join(pattern.join) : null
  }
  if (pattern.type === 'filterCellAnd') {
    for (const row of rows) {
      const c = cells(row)
      if (pattern.checks.every((ch) => {
        const v = c[ch.idx] ?? ''
        return ch.mode === 'includes' ? v.includes(ch.needle) : v === ch.needle
      })) return c[pattern.readIdx] ?? null
    }
    return null
  }
  let n = 0
  for (const row of rows) {
    const c = cells(row)
    if (pattern.checks.every((ch) => (c[ch.idx] ?? '') === ch.value)) n++
  }
  return String(n)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function colorizePunctuation(html: string): string {
  return html.replace(/(<[^>]+>)|([()[\]{}])/g, (_, tag, ch) => {
    if (tag != null) return tag
    return `<span class="tok-brace">${ch}</span>`
  })
}

function highlightSnippet(source: string): string {
  const strings: string[] = []
  let s = source.replace(/'([^'\\]|\\.)*'/g, (m) => {
    strings.push(`<span class="tok-str">${escapeHtml(m)}</span>`)
    return `__S${strings.length - 1}__`
  })
  s = escapeHtml(s)
  strings.forEach((html, i) => { s = s.replace(`__S${i}__`, html) })
  s = s.replace(/(^|\n)([\t ]*)(Name|Role|Office|Status|Department)(\s*:)/gm,
    '$1$2<span class="tok-prop">$3</span><span class="tok-punct">$4</span>')
  s = s.replace(/([\{,]\s*)(has|hasText)(\s*:)/g,
    '$1<span class="tok-prop">$2</span><span class="tok-punct">$3</span>')
  s = s.replace(/\b(async|await|return)\b/g, '<span class="tok-kw-flow">$&</span>')
  s = s.replace(/\b(const|let|for|of|if)\b/g, '<span class="tok-kw">$&</span>')
  s = s.replace(/\b(getRow|getCell|findRows|locator|filter|nth|innerText|textContent|all|push|map|join|trim|Promise)\b/g,
    '<span class="tok-fn">$&</span>')
  s = s.replace(/\b(page|table)\b/g, '<span class="tok-root">$&</span>')
  s = s.replace(/\b(row|rows|tr|tds|n|names|role|office|status)\b/g, '<span class="tok-var">$&</span>')
  s = s.replace(/\b(\d+)\b/g, '<span class="tok-num">$&</span>')
  s = s.replace(/\s*(&&|\|\|)\s*/g, ' <span class="tok-op">$1</span> ')
  return colorizePunctuation(s)
}

const columnOrder = ref<ColKey[]>([...originalOrder])
const selectedId = ref<string>(questions[0]!.id)
const currentQuestion = computed(() => questions.find((q) => q.id === selectedId.value) ?? questions[0]!)
const columnsOk = computed(() => columnOrder.value.every((k, i) => k === originalOrder[i]))

function shuffleColumns() {
  const next = [...columnOrder.value]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j]!, next[i]!]
  }
  columnOrder.value = next
}
function resetLayout() { columnOrder.value = [...originalOrder] }

const brittleRaw = computed(() => evalBrittle(currentQuestion.value.brittle, columnOrder.value))
const brittleOk = computed(() => brittleRaw.value?.trim() === currentQuestion.value.expected.trim())
const brittleDisplay = computed(() => brittleRaw.value || '—')
const brittleHighlighted = computed(() => highlightSnippet(currentQuestion.value.brittleCode))
const smartHighlighted = computed(() => highlightSnippet(currentQuestion.value.smartCode))
</script>

<template>
  <div class="ba2">
    <!-- Header row: question + controls -->
    <div class="ba2-header">
      <div class="ba2-q-wrap">
        <label class="ba2-q-label" for="ba2-q">Question</label>
        <select id="ba2-q" v-model="selectedId" class="ba2-q-select">
          <option v-for="q in questions" :key="q.id" :value="q.id">{{ q.prompt }}</option>
        </select>
      </div>
      <div class="ba2-controls">
        <button type="button" class="ba2-btn-shuffle" @click="shuffleColumns">Shuffle columns</button>
        <button type="button" class="ba2-btn-reset" :disabled="columnsOk" @click="resetLayout">Reset</button>
        <span class="ba2-tag" :data-shuffled="!columnsOk">{{ columnsOk ? 'Original order' : 'Shuffled' }}</span>
      </div>
    </div>

    <!-- Main: table left, code panels right -->
    <div class="ba2-main">
      <div class="ba2-table-col">
        <div class="ba2-table-shell">
          <table class="ba2-table" :aria-label="`Employee table — ${currentQuestion.prompt}`">
            <thead>
              <tr><th v-for="key in columnOrder" :key="key">{{ labels[key] }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.name">
                <td v-for="key in columnOrder" :key="key">{{ row[key] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="ba2-code-col">
        <!-- Brittle -->
        <div class="ba2-panel ba2-panel--brittle">
          <div class="ba2-panel-head">
            <span class="ba2-panel-label ba2-panel-label--brittle">Brittle (fixed indices)</span>
            <span class="ba2-result" :class="brittleOk ? 'ba2-result--ok' : 'ba2-result--bad'">
              {{ brittleOk ? '✓' : '✗' }} {{ brittleDisplay }}
            </span>
          </div>
          <pre class="ba2-pre"><code class="ba2-code" v-html="brittleHighlighted"></code></pre>
        </div>

        <!-- Smart Table -->
        <div class="ba2-panel ba2-panel--smart">
          <div class="ba2-panel-head">
            <span class="ba2-panel-label ba2-panel-label--smart">Smart Table</span>
            <span class="ba2-result ba2-result--ok">✓ {{ currentQuestion.expected }}</span>
          </div>
          <pre class="ba2-pre"><code class="ba2-code" v-html="smartHighlighted"></code></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ba2 {
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ba2-header {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.ba2-q-wrap {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 200px;
}

.ba2-q-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-2);
}

.ba2-q-select {
  padding: 7px 11px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 0.85rem;
  cursor: pointer;
  width: 100%;
}
.ba2-q-select:focus {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 1px;
}

.ba2-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ba2-btn-shuffle {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-size: 0.8rem;
  cursor: pointer;
  color: var(--vp-c-text-1);
}
.ba2-btn-shuffle:hover {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 45%, var(--vp-c-divider));
}

.ba2-btn-reset {
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  font-size: 0.78rem;
  cursor: pointer;
  color: var(--vp-c-text-2);
}
.ba2-btn-reset:disabled { opacity: 0.4; cursor: not-allowed; }
.ba2-btn-reset:not(:disabled):hover { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }

.ba2-tag {
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  font-size: 0.73rem;
  color: var(--vp-c-text-2);
  white-space: nowrap;
}
.ba2-tag[data-shuffled='true'] {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 50%, var(--vp-c-divider));
  color: var(--vp-c-brand-1);
}

.ba2-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

@media (max-width: 900px) {
  .ba2-main { grid-template-columns: 1fr; }
}

/* Table */
.ba2-table-shell {
  border: 1px solid color-mix(in srgb, var(--vp-c-divider) 85%, transparent);
  border-radius: 10px;
  overflow: hidden;
  background: var(--vp-c-bg);
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
}

.ba2-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.76rem;
}
.ba2-table th,
.ba2-table td {
  padding: 7px 9px;
  border-bottom: 1px solid color-mix(in srgb, var(--vp-c-divider) 70%, transparent);
  text-align: left;
}
.ba2-table th {
  background: color-mix(in srgb, var(--vp-c-bg-soft) 80%, var(--vp-c-bg));
  font-weight: 600;
  font-size: 0.69rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-2);
}
.ba2-table tbody tr:last-child td { border-bottom: none; }
.ba2-table tbody tr:hover td {
  background: color-mix(in srgb, var(--vp-c-brand-1) 7%, var(--vp-c-bg));
}

/* Code panels */
.ba2-code-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ba2-panel {
  border-radius: 10px;
  border: 1px solid var(--vp-c-divider);
  overflow: hidden;
}
.ba2-panel--brittle {
  border-color: color-mix(in srgb, #f87171 30%, var(--vp-c-divider));
}
.ba2-panel--smart {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 35%, var(--vp-c-divider));
}

.ba2-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 12px 6px;
  background: color-mix(in srgb, var(--vp-c-bg-soft) 70%, var(--vp-c-bg));
  border-bottom: 1px solid var(--vp-c-divider);
}

.ba2-panel-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.ba2-panel-label--brittle { color: #b45309; }
.ba2-panel-label--smart { color: var(--vp-c-brand-1); }

.ba2-result {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 55%;
}
.ba2-result--ok {
  background: color-mix(in srgb, #16a34a 14%, var(--vp-c-bg-soft));
  color: #15803d;
  border: 1px solid color-mix(in srgb, #22c55e 40%, transparent);
}
.ba2-result--bad {
  background: color-mix(in srgb, #dc2626 10%, var(--vp-c-bg-soft));
  color: #b91c1c;
  border: 1px solid color-mix(in srgb, #f87171 40%, transparent);
}

.ba2-pre {
  margin: 0;
  padding: 10px 13px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 0.69rem;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ba2-code :deep(.tok-kw) { color: #569cd6; font-weight: 500; }
.ba2-code :deep(.tok-kw-flow) { color: #c586c0; font-weight: 500; }
.ba2-code :deep(.tok-fn) { color: #dcdcaa; }
.ba2-code :deep(.tok-str) { color: #ce9178; }
.ba2-code :deep(.tok-root), .ba2-code :deep(.tok-var) { color: #9cdcfe; }
.ba2-code :deep(.tok-prop) { color: #9cdcfe; }
.ba2-code :deep(.tok-punct) { color: #d4d4d4; }
.ba2-code :deep(.tok-brace) { color: #da70d6; }
.ba2-code :deep(.tok-num) { color: #b5cea8; }
.ba2-code :deep(.tok-op) { color: #d4d4d4; }
</style>
