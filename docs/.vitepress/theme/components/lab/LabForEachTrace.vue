<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

const pages = [
  [
    { name: 'Airi Satou',    role: 'Accountant', office: 'Tokyo'  },
    { name: 'Bradley Greer', role: 'Engineer',   office: 'London' },
    { name: 'Cedric Kelly',  role: 'Manager',    office: 'Berlin' },
  ],
  [
    { name: 'Dana Wade',     role: 'Engineer',   office: 'Tokyo'  },
    { name: 'Eric Monk',     role: 'Manager',    office: 'London' },
    { name: 'Fiona Yang',    role: 'Accountant', office: 'Sydney' },
  ],
  [
    { name: 'George Fox',    role: 'Engineer',   office: 'Berlin' },
    { name: 'Helen Vance',   role: 'Manager',    office: 'Sydney' },
    { name: 'Ivan Cross',    role: 'Accountant', office: 'Tokyo'  },
  ],
]

const CRITERIA = 'Engineer'

type Phase = 'idle' | 'visiting' | 'paging' | 'done'
const phase       = ref<Phase>('idle')
const pageIdx     = ref(0)
const rowIdx      = ref(-1)
const selected    = ref(new Set<string>())
const visitedPage = ref(-1) // last fully-visited page index

const currentRows = computed(() => pages[pageIdx.value])

const checkedCount = computed(() => selected.value.size)

function rowState(name: string, i: number): 'idle' | 'visiting' | 'selected' | 'skipped' {
  if (phase.value === 'idle') return 'idle'
  if (phase.value === 'paging') return selected.value.has(name) ? 'selected' : 'idle'
  if (phase.value === 'done')   return selected.value.has(name) ? 'selected' : 'idle'
  // visiting phase
  if (i === rowIdx.value) return 'visiting'
  if (i < rowIdx.value || visitedPage.value > pageIdx.value)
    return selected.value.has(name) ? 'selected' : 'skipped'
  return 'idle'
}

const statusText = computed(() => {
  if (phase.value === 'idle') return ''
  if (phase.value === 'done') return `✓ done — ${checkedCount.value} rows checked`
  if (phase.value === 'paging') return `advancing to page ${pageIdx.value + 1}…`
  if (rowIdx.value < 0) return ''
  const row = currentRows.value[rowIdx.value]
  if (!row) return ''
  return row.role === CRITERIA
    ? `✓ checking — ${row.role}`
    : `↩ skipping — ${row.role}`
})
const statusOk = computed(() => phase.value === 'done' || (phase.value === 'visiting' && rowIdx.value >= 0 && currentRows.value[rowIdx.value]?.role === CRITERIA))

const timers: ReturnType<typeof setTimeout>[] = []
function after(ms: number, fn: () => void) { timers.push(setTimeout(fn, ms)) }
onUnmounted(() => timers.forEach(clearTimeout))

function visitRow(pIdx: number, rIdx: number) {
  if (pIdx >= pages.length) {
    phase.value = 'done'
    return
  }
  pageIdx.value = pIdx
  rowIdx.value = rIdx

  const row = pages[pIdx][rIdx]
  const isMatch = row.role === CRITERIA
  const holdMs = isMatch ? 550 : 420

  after(holdMs, () => {
    if (isMatch) selected.value = new Set([...selected.value, row.name])

    // advance
    if (rIdx + 1 < pages[pIdx].length) {
      visitRow(pIdx, rIdx + 1)
    } else {
      visitedPage.value = pIdx
      if (pIdx + 1 < pages.length) {
        phase.value = 'paging'
        rowIdx.value = -1
        after(500, () => visitRow(pIdx + 1, 0))
      } else {
        phase.value = 'done'
      }
    }
  })
}

function run() {
  timers.forEach(clearTimeout)
  timers.length = 0
  phase.value = 'idle'
  pageIdx.value = 0
  rowIdx.value = -1
  selected.value = new Set()
  visitedPage.value = -1
  after(400, () => {
    phase.value = 'visiting'
    visitRow(0, 0)
  })
}

run()
</script>

<template>
  <div class="fe">

    <!-- Code panel -->
    <div class="fe-editor">
      <div class="fe-ln"><span class="t-kw">await</span><span class="t-dim">&nbsp;</span><span class="t-root">table</span><span class="t-dim">.</span><span class="t-fn">forEach</span><span class="t-brace">(</span><span class="t-kw">async</span><span class="t-dim"> (</span><span class="t-var">row</span><span class="t-dim">) => </span><span class="t-brace">{</span></div>
      <div class="fe-ln"><span class="t-indent">&nbsp;&nbsp;</span><span class="t-kw">const</span><span class="t-dim">&nbsp;</span><span class="t-var">role</span><span class="t-dim"> = </span><span class="t-kw">await</span><span class="t-dim">&nbsp;</span><span class="t-var">row</span></div>
      <div class="fe-ln"><span class="t-indent">&nbsp;&nbsp;&nbsp;&nbsp;</span><span class="t-dim">.</span><span class="t-fn">getCell</span><span class="t-brace">(</span><span class="t-str">'Role'</span><span class="t-brace">)</span><span class="t-dim">.</span><span class="t-fn">textContent</span><span class="t-brace">()</span></div>
      <div class="fe-ln fe-ln--gap"><span class="t-indent">&nbsp;&nbsp;</span><span class="t-kw">if</span><span class="t-dim"> (</span><span class="t-var">role</span><span class="t-dim"> === </span><span class="t-str">'Engineer'</span><span class="t-dim">) </span><span class="t-brace">{</span></div>
      <div class="fe-ln"><span class="t-indent">&nbsp;&nbsp;&nbsp;&nbsp;</span><span class="t-kw">await</span><span class="t-dim">&nbsp;</span><span class="t-var">row</span><span class="t-dim">.</span><span class="t-fn">getCell</span><span class="t-brace">(</span><span class="t-str">'Select'</span><span class="t-brace">)</span></div>
      <div class="fe-ln"><span class="t-indent">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span class="t-dim">.</span><span class="t-fn">getByRole</span><span class="t-brace">(</span><span class="t-str">'checkbox'</span><span class="t-brace">)</span><span class="t-dim">.</span><span class="t-fn">check</span><span class="t-brace">()</span></div>
      <div class="fe-ln"><span class="t-indent">&nbsp;&nbsp;</span><span class="t-brace">}</span></div>
      <div class="fe-ln"><span class="t-brace">}</span><span class="t-brace">)</span></div>

      <transition name="fe-fade">
        <div v-if="phase !== 'idle'" class="fe-ln fe-status" :class="statusOk ? 'fe-status--ok' : 'fe-status--dim'">
          <span class="t-dim">// </span>{{ statusText }}
        </div>
      </transition>
    </div>

    <!-- Table panel -->
    <div class="fe-right">
      <div class="fe-table-head">
        <span class="fe-page-label">Page {{ pageIdx + 1 }} / {{ pages.length }}</span>
        <div class="fe-dots">
          <span v-for="(_, i) in pages" :key="i" class="fe-dot" :class="{ 'fe-dot--active': i === pageIdx }" />
        </div>
        <transition name="fe-fade">
          <span v-if="checkedCount > 0" class="fe-badge">{{ checkedCount }} checked</span>
        </transition>
        <button v-if="phase === 'done'" class="fe-replay" @click="run">↺ Replay</button>
      </div>

      <div class="fe-table-shell">
        <table class="fe-table">
          <thead><tr><th></th><th>Name</th><th>Role</th><th>Office</th></tr></thead>
          <tbody>
            <tr v-for="(row, i) in currentRows" :key="row.name" :class="`fe-row--${rowState(row.name, i)}`">
              <td class="fe-cell-cb">
                <span class="fe-cb" :class="{ 'fe-cb--checked': selected.has(row.name) }" />
              </td>
              <td>{{ row.name }}</td>
              <td>{{ row.role }}</td>
              <td>{{ row.office }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<style scoped>
.fe {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
  gap: 16px;
  align-items: start;
  margin: 16px 0;
}
@media (max-width: 760px) { .fe { grid-template-columns: 1fr; } }

/* Editor */
.fe-editor {
  background: #1e1e1e;
  border: 1px solid #2d2d2d;
  border-radius: 10px;
  padding: 12px 16px;
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 0.76rem;
  line-height: 1.9;
}
.fe-ln { display: flex; align-items: center; flex-wrap: nowrap; }
.fe-ln--gap { margin-top: 0.25rem; }
.t-indent { white-space: pre; color: #858585; user-select: none; }
.t-kw    { color: #c586c0; }
.t-fn    { color: #dcdcaa; }
.t-root  { color: #9cdcfe; }
.t-var   { color: #9cdcfe; }
.t-str   { color: #ce9178; }
.t-brace { color: #da70d6; }
.t-dim   { color: #858585; }
.fe-status { font-size: 0.72rem; margin-top: 2px; }
.fe-status--dim { color: #858585; }
.fe-status--ok  { color: #4ec994; }

/* Table panel header */
.fe-right { display: flex; flex-direction: column; gap: 8px; }
.fe-table-head { display: flex; align-items: center; gap: 10px; min-height: 26px; }
.fe-page-label {
  font-size: 0.69rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--vp-c-text-2);
}
.fe-dots { display: flex; gap: 5px; }
.fe-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--vp-c-divider);
  transition: background 0.25s, transform 0.25s;
}
.fe-dot--active { background: var(--vp-c-brand-1); transform: scale(1.35); }

.fe-badge {
  font-size: 0.71rem; font-weight: 600; padding: 2px 8px; border-radius: 999px;
  background: color-mix(in srgb, #16a34a 14%, var(--vp-c-bg-soft));
  color: #15803d;
  border: 1px solid color-mix(in srgb, #22c55e 45%, transparent);
}

.fe-replay {
  margin-left: auto;
  font-size: 0.72rem; font-weight: 600;
  padding: 3px 11px; border-radius: 6px;
  border: 1px solid #22c55e;
  color: #22c55e;
  background: color-mix(in srgb, #22c55e 8%, var(--vp-c-bg-soft));
  cursor: pointer;
  box-shadow: 0 0 0 2px color-mix(in srgb, #22c55e 20%, transparent);
  transition: background 0.15s;
}
.fe-replay:hover { background: color-mix(in srgb, #22c55e 15%, var(--vp-c-bg-soft)); }

/* Table */
.fe-table-shell {
  border: 1px solid color-mix(in srgb, var(--vp-c-divider) 85%, transparent);
  border-radius: 10px; overflow: hidden; background: var(--vp-c-bg);
  display: flex; justify-content: center;
}
.fe-table { width: auto; min-width: 260px; border-collapse: collapse; font-size: 0.76rem; }
.fe-table th, .fe-table td {
  padding: 7px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--vp-c-divider) 70%, transparent);
  text-align: left;
}
.fe-table th {
  background: color-mix(in srgb, var(--vp-c-bg-soft) 80%, var(--vp-c-bg));
  font-weight: 600; font-size: 0.69rem; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--vp-c-text-2);
}
.fe-table tbody tr:last-child td { border-bottom: none; }
.fe-cell-cb { width: 32px; padding-right: 4px; }

/* Checkbox */
.fe-cb {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px;
  border: 1.5px solid var(--vp-c-divider);
  border-radius: 3px;
  transition: background 0.2s, border-color 0.2s;
  vertical-align: middle;
}
.fe-cb--checked {
  background: #22c55e;
  border-color: #22c55e;
}
.fe-cb--checked::after {
  content: '';
  display: block;
  width: 4px; height: 7px;
  border: 1.5px solid #fff;
  border-top: none; border-left: none;
  transform: rotate(45deg) translate(-1px, -1px);
}

/* Row states */
.fe-row--idle td     { transition: background 0.2s, opacity 0.2s; }
.fe-row--visiting td {
  background: color-mix(in srgb, #6366f1 13%, var(--vp-c-bg));
  transition: background 0.15s;
}
.fe-row--visiting td:first-child { box-shadow: inset 3px 0 0 #818cf8; }
.fe-row--skipped td  { opacity: 0.35; transition: opacity 0.3s; }
.fe-row--selected td {
  background: color-mix(in srgb, #16a34a 10%, var(--vp-c-bg));
  transition: background 0.25s, opacity 0.25s;
}
.fe-row--selected td:first-child { box-shadow: inset 3px 0 0 #22c55e; }

/* Transitions */
.fe-fade-enter-active, .fe-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fe-fade-enter-from, .fe-fade-leave-to { opacity: 0; transform: translateY(-3px); }
</style>
