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

const TARGET_NAME  = 'Helen Vance'
const TARGET_CELL  = 'Office'
const TARGET_VALUE = 'Sydney'
const targetPage   = pages.findIndex(p => p.some(r => r.name === TARGET_NAME))

// idle → checking → rejected (user clicks Next) | found → asserting → done
type Phase = 'idle' | 'checking' | 'rejected' | 'found' | 'asserting' | 'done'
const phase   = ref<Phase>('idle')
const pageIdx = ref(0)

const currentRows = computed(() => pages[pageIdx.value])

function rowState(name: string): 'idle' | 'checking' | 'rejected' | 'match' {
  if (phase.value === 'idle')     return 'idle'
  if (phase.value === 'checking') return 'checking'
  if (phase.value === 'rejected') return 'rejected'
  if (phase.value === 'found' || phase.value === 'asserting' || phase.value === 'done')
    return name === TARGET_NAME ? 'match' : 'rejected'
  return 'idle'
}

const statusText = computed(() => {
  if (phase.value === 'idle')     return ''
  if (phase.value === 'checking') return `checking page ${pageIdx.value + 1}…`
  if (phase.value === 'rejected') return `no match on page ${pageIdx.value + 1}`
  if (phase.value === 'found')    return `✓ found on page ${pageIdx.value + 1}`
  if (phase.value === 'asserting' || phase.value === 'done') return `✓ '${TARGET_VALUE}' matches`
  return ''
})
const statusOk = computed(() => ['found','asserting','done'].includes(phase.value))

const timers: ReturnType<typeof setTimeout>[] = []
function after(ms: number, fn: () => void) { timers.push(setTimeout(fn, ms)) }
onUnmounted(() => timers.forEach(clearTimeout))

function landOnPage() {
  phase.value = 'checking'
  after(700, () => {
    if (pageIdx.value === targetPage) {
      phase.value = 'found'
      after(1000, () => {
        phase.value = 'asserting'
        after(1800, () => { phase.value = 'done' })
      })
    } else {
      phase.value = 'rejected'
    }
  })
}

function onNext() {
  if (phase.value !== 'rejected') return
  pageIdx.value++
  phase.value = 'idle'
  after(200, () => landOnPage())
}

function onReplay() {
  timers.forEach(clearTimeout)
  timers.length = 0
  phase.value = 'idle'
  pageIdx.value = 0
  after(300, () => landOnPage())
}

// auto-start
landOnPage()
</script>

<template>
  <div class="grt">

    <!-- Code panel -->
    <div class="grt-editor">
      <div class="grt-code-block" :class="phase === 'asserting' || phase === 'done' ? 'grt-block--muted' : 'grt-block--on'">
        <div class="grt-ln"><span class="t-kw">const</span><span class="t-dim">&nbsp;</span><span class="t-var">row</span><span class="t-dim"> = </span><span class="t-kw">await</span><span class="t-dim">&nbsp;</span><span class="t-root">table</span><span class="t-dim">.</span><span class="t-fn">findRow</span><span class="t-brace">(</span></div>
        <div class="grt-ln"><span class="t-indent">&nbsp;&nbsp;</span><span class="t-brace">{</span><span class="t-dim"> </span><span class="t-prop">Name</span><span class="t-dim">: </span><span class="t-str">'{{ TARGET_NAME }}'</span><span class="t-dim"> </span><span class="t-brace">}</span><span class="t-dim">,</span></div>
        <div class="grt-ln"><span class="t-indent">&nbsp;&nbsp;</span><span class="t-brace">{</span><span class="t-dim"> </span><span class="t-prop">maxPages</span><span class="t-dim">: </span><span class="t-num">5</span><span class="t-dim"> </span><span class="t-brace">}</span></div>
        <div class="grt-ln"><span class="t-brace">)</span></div>
        <transition name="grt-fade">
          <div v-if="phase !== 'idle'" class="grt-ln grt-status" :class="statusOk ? 'grt-status--ok' : 'grt-status--dim'">
            <span class="t-dim">// </span>{{ statusText }}
          </div>
        </transition>
      </div>

      <div class="grt-spacer" />

      <div class="grt-code-block" :class="phase === 'asserting' || phase === 'done' ? 'grt-block--on' : 'grt-block--muted'">
        <div class="grt-ln"><span class="t-kw">await</span><span class="t-dim">&nbsp;</span><span class="t-fn">expect</span><span class="t-brace">(</span></div>
        <div class="grt-ln"><span class="t-indent">&nbsp;&nbsp;</span><span class="t-var">row</span><span class="t-dim">.</span><span class="t-fn">getCell</span><span class="t-brace">(</span><span class="t-str">'{{ TARGET_CELL }}'</span><span class="t-brace">)</span></div>
        <div class="grt-ln"><span class="t-brace">)</span><span class="t-dim">.</span><span class="t-fn">toHaveText</span><span class="t-brace">(</span><span class="t-str">'{{ TARGET_VALUE }}'</span><span class="t-brace">)</span></div>
        <transition name="grt-fade">
          <div v-if="phase === 'asserting' || phase === 'done'" class="grt-ln grt-status grt-status--ok">
            <span class="t-dim">// </span>{{ statusText }}
          </div>
        </transition>
      </div>
    </div>

    <!-- Table panel -->
    <div class="grt-right">
      <div class="grt-table-head">
        <span class="grt-page-label">Page {{ pageIdx + 1 }} / {{ pages.length }}</span>
        <div class="grt-dots">
          <span v-for="(_, i) in pages" :key="i" class="grt-dot" :class="{ 'grt-dot--active': i === pageIdx }" />
        </div>
        <button
          v-if="phase !== 'done'"
          class="grt-btn"
          :class="{ 'grt-btn--ready': phase === 'rejected' }"
          :disabled="phase !== 'rejected'"
          @click="onNext"
        >Next →</button>
        <button v-else class="grt-btn grt-btn--replay" @click="onReplay">↺ Replay</button>
      </div>

      <div class="grt-table-shell">
        <table class="grt-table">
          <thead><tr><th>Name</th><th>Role</th><th>Office</th></tr></thead>
          <tbody>
            <tr v-for="row in currentRows" :key="row.name" :class="`grt-row--${rowState(row.name)}`">
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
.grt {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 16px;
  align-items: start;
  margin: 16px 0;
}
@media (max-width: 760px) { .grt { grid-template-columns: 1fr; } }

/* Editor */
.grt-editor {
  background: #1e1e1e;
  border: 1px solid #2d2d2d;
  border-radius: 10px;
  padding: 12px 16px;
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 0.76rem;
  line-height: 1.9;
  display: flex;
  flex-direction: column;
}
.grt-code-block { transition: opacity 0.35s; }
.grt-block--on    { opacity: 1; }
.grt-block--muted { opacity: 0.3; }
.grt-spacer { height: 0.55rem; }

.grt-ln { display: flex; align-items: center; flex-wrap: nowrap; }
.t-indent { white-space: pre; color: #858585; user-select: none; }
.t-kw    { color: #c586c0; }
.t-fn    { color: #dcdcaa; }
.t-root  { color: #9cdcfe; }
.t-var   { color: #9cdcfe; }
.t-prop  { color: #9cdcfe; }
.t-str   { color: #ce9178; }
.t-num   { color: #b5cea8; }
.t-brace { color: #da70d6; }
.t-dim   { color: #858585; }

.grt-status { font-size: 0.72rem; }
.grt-status--dim { color: #858585; }
.grt-status--ok  { color: #4ec994; }

/* Right panel */
.grt-right { display: flex; flex-direction: column; gap: 8px; }
.grt-table-head { display: flex; align-items: center; gap: 10px; }
.grt-page-label {
  font-size: 0.69rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--vp-c-text-2);
}
.grt-dots { display: flex; gap: 5px; }
.grt-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--vp-c-divider);
  transition: background 0.25s, transform 0.25s;
}
.grt-dot--active { background: var(--vp-c-brand-1); transform: scale(1.35); }

.grt-btn {
  margin-left: auto;
  font-size: 0.72rem; font-weight: 600;
  padding: 3px 11px; border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-3);
  cursor: default;
  transition: border-color 0.2s, color 0.2s, background 0.2s, box-shadow 0.2s;
}
.grt-btn--ready {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 8%, var(--vp-c-bg-soft));
  cursor: pointer;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--vp-c-brand-1) 20%, transparent);
}
.grt-btn--ready:hover {
  background: color-mix(in srgb, var(--vp-c-brand-1) 15%, var(--vp-c-bg-soft));
}
.grt-btn--replay {
  border-color: #22c55e;
  color: #22c55e;
  background: color-mix(in srgb, #22c55e 8%, var(--vp-c-bg-soft));
  cursor: pointer;
  box-shadow: 0 0 0 2px color-mix(in srgb, #22c55e 20%, transparent);
}
.grt-btn--replay:hover {
  background: color-mix(in srgb, #22c55e 15%, var(--vp-c-bg-soft));
}

/* Table */
.grt-table-shell {
  border: 1px solid color-mix(in srgb, var(--vp-c-divider) 85%, transparent);
  border-radius: 10px; overflow: hidden; background: var(--vp-c-bg);
  display: flex; justify-content: center;
}
.grt-table { width: auto; min-width: 260px; border-collapse: collapse; font-size: 0.76rem; }
.grt-table th, .grt-table td {
  padding: 7px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--vp-c-divider) 70%, transparent);
  text-align: left;
}
.grt-table th {
  background: color-mix(in srgb, var(--vp-c-bg-soft) 80%, var(--vp-c-bg));
  font-weight: 600; font-size: 0.69rem; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--vp-c-text-2);
}
.grt-table tbody tr:last-child td { border-bottom: none; }

/* Row states */
.grt-row--idle td     { transition: background 0.2s, opacity 0.2s; }
.grt-row--checking td {
  background: color-mix(in srgb, #6366f1 13%, var(--vp-c-bg));
  transition: background 0.15s;
}
.grt-row--checking td:first-child { box-shadow: inset 3px 0 0 #818cf8; }
.grt-row--rejected td {
  background: color-mix(in srgb, #dc2626 8%, var(--vp-c-bg));
  transition: background 0.25s;
}
.grt-row--rejected td:first-child { box-shadow: inset 3px 0 0 #f87171; }
.grt-row--match td {
  background: color-mix(in srgb, #16a34a 12%, var(--vp-c-bg));
  transition: background 0.25s;
}
.grt-row--match td:first-child { box-shadow: inset 3px 0 0 #22c55e; }

/* Transition */
.grt-fade-enter-active, .grt-fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.grt-fade-enter-from, .grt-fade-leave-to { opacity: 0; transform: translateY(-3px); }
</style>
