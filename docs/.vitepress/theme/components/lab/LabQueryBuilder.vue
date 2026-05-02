<script setup lang="ts">
import { computed, ref } from 'vue'
import { findSimilar, buildColumnNotFoundError } from '../../../../../src/utils/stringUtils.ts'

const rows = [
  { name: 'Airi Satou',    role: 'Accountant', office: 'Tokyo',  status: 'Active', dept: 'Finance' },
  { name: 'Bradley Greer', role: 'Engineer',   office: 'London', status: 'Active', dept: 'Engineering' },
  { name: 'Cedric Kelly',  role: 'Manager',    office: 'Berlin', status: 'Review', dept: 'Operations' },
  { name: 'Dana Wade',     role: 'Engineer',   office: 'Tokyo',  status: 'Active', dept: 'Engineering' },
  { name: 'Eric Monk',     role: 'Manager',    office: 'London', status: 'Review', dept: 'Operations' },
  { name: 'Fiona Yang',    role: 'Accountant', office: 'Sydney', status: 'Active', dept: 'Finance' },
  { name: 'George Fox',    role: 'Engineer',   office: 'Berlin', status: 'Active', dept: 'Engineering' },
  { name: 'Helen Vance',   role: 'Manager',    office: 'Sydney', status: 'Active', dept: 'Operations' },
]

// Maps the display column key → data field
const colMap: Record<string, keyof typeof rows[0]> = {
  Name: 'name',
  Role: 'role',
  Office: 'office',
  Status: 'status',
  Department: 'dept',
}
const validCols = Object.keys(colMap)

type Pair = { key: string; value: string }
const pairs = ref<Pair[]>([{ key: '', value: '' }])

function addPair() {
  if (pairs.value.length < validCols.length) pairs.value.push({ key: '', value: '' })
}
function removePair(i: number) { pairs.value.splice(i, 1) }

function isValidKey(key: string) { return validCols.includes(key) }

// Only pairs with a valid key and non-empty value participate in matching
const activePairs = computed(() =>
  pairs.value.filter((p) => p.key && p.value && isValidKey(p.key))
)

// First pair with a bad key (library would throw before matching)
const firstBadPair = computed(() => pairs.value.find((p) => p.key && !isValidKey(p.key)) ?? null)

const typoError = computed(() =>
  firstBadPair.value ? buildColumnNotFoundError(firstBadPair.value.key, validCols) : ''
)

const matches = computed(() => {
  if (firstBadPair.value || activePairs.value.length === 0) return []
  return rows.filter((row) =>
    activePairs.value.every((p) => {
      const field = colMap[p.key]
      return field ? row[field] === p.value : false
    })
  )
})
const matchSet = computed(() => new Set(matches.value.map((r) => r.name)))
const matchCount = computed(() => matches.value.length)

type ResultState = 'idle' | 'ok' | 'none' | 'many' | 'typo'
const resultState = computed((): ResultState => {
  if (firstBadPair.value) return 'typo'
  if (activePairs.value.length === 0) return 'idle'
  if (matchCount.value === 1) return 'ok'
  if (matchCount.value === 0) return 'none'
  return 'many'
})

// Second line: getCell
const cellCol = ref('')
const cellValue = computed(() => {
  if (resultState.value !== 'ok' || !cellCol.value) return null
  const field = colMap[cellCol.value]
  return field ? matches.value[0]?.[field] ?? null : null
})
</script>

<template>
  <div class="qb">

    <div class="qb-left">
      <!-- Code-editor style getRow input -->
      <div class="qb-editor">
        <div class="qb-ln qb-ln--static">
          <span class="t-kw">const</span><span class="t-dim">&nbsp;</span><span class="t-var">row</span><span class="t-dim"> = </span><span class="t-root">table</span><span class="t-dim">.</span><span class="t-fn">getRow</span><span class="t-brace">(</span><span class="t-brace">{</span>
        </div>

        <div v-for="(pair, i) in pairs" :key="i" class="qb-ln qb-ln--pair">
          <span class="t-indent">&nbsp;&nbsp;</span>
          <input
            v-model="pair.key"
            class="qb-input qb-input--key"
            :class="{ 'qb-input--key-invalid': pair.key && !isValidKey(pair.key) }"
            :style="{ width: `${(pair.key.length || 'Column'.length) + 1}ch` }"
            placeholder="Column"
            spellcheck="false"
          />
          <span class="t-punct">: </span>
          <span class="t-quote">'</span>
          <input
            v-model="pair.value"
            class="qb-input qb-input--val"
            placeholder="value"
            :style="{ width: `${Math.max(5, pair.value.length + 1)}ch` }"
            spellcheck="false"
          />
          <span class="t-quote">'</span>
          <span class="t-punct">,</span>
          <button class="qb-del" @click="removePair(i)" aria-label="Remove field">×</button>
        </div>

        <div v-if="pairs.length < validCols.length" class="qb-ln">
          <span class="t-indent">&nbsp;&nbsp;</span>
          <button class="qb-add" @click="addPair">// + add field</button>
        </div>

        <div class="qb-ln qb-ln--static">
          <span class="t-brace">}</span><span class="t-brace">)</span>
        </div>

        <div class="qb-ln qb-ln--cell">
          <span class="t-kw">await</span><span class="t-dim">&nbsp;</span><span class="t-var">row</span><span class="t-dim">.</span><span class="t-fn">getCell</span><span class="t-brace">(</span><span class="t-quote">'</span><input
            v-model="cellCol"
            class="qb-input qb-input--cellcol"
            :style="{ width: `${(cellCol.length || 'Column'.length) + 1}ch` }"
            placeholder="Column"
            spellcheck="false"
          /><span class="t-quote">'</span><span class="t-brace">)</span><span class="t-dim">.</span><span class="t-fn">textContent</span><span class="t-brace">(</span><span class="t-brace">)</span>
        </div>
        <transition name="qb-fade">
          <div v-if="cellValue !== null" class="qb-ln">
            <span class="t-cell-result">//&nbsp;→&nbsp;'{{ cellValue }}'</span>
          </div>
        </transition>
      </div>

      <!-- Result -->
      <transition name="qb-fade">
        <div v-if="resultState !== 'idle'" class="qb-result" :class="resultState === 'ok' ? 'qb-result--ok' : 'qb-result--err'">
          <template v-if="resultState === 'ok'">
            <span class="qb-result-icon">✓</span>
            <span>Row found — <strong>{{ matches[0]?.name }}</strong></span>
          </template>
          <template v-else-if="resultState === 'none'">
            <span class="qb-result-icon">✗</span>
            <span>No row matched — <code>getRow</code> throws if nothing is found</span>
          </template>
          <template v-else-if="resultState === 'many'">
            <span class="qb-result-icon">✗</span>
            <span>{{ matchCount }} rows matched — <code>getRow</code> expects exactly 1. Use <code>findRows</code> for multiple matches, or add more filters to narrow it down.</span>
          </template>
          <template v-else-if="resultState === 'typo'">
            <span class="qb-result-icon">✗</span>
            <pre class="qb-error-pre">{{ typoError }}</pre>
          </template>
        </div>
      </transition>
    </div>

    <!-- Table -->
    <div class="qb-right">
      <div class="qb-table-head">
        <span class="qb-section-label">Table</span>
        <transition name="qb-fade">
          <span v-if="activePairs.length > 0" class="qb-badge" :class="matchCount === 1 ? 'qb-badge--ok' : 'qb-badge--err'">
            {{ matchCount }} match{{ matchCount !== 1 ? 'es' : '' }}
          </span>
        </transition>
      </div>
      <div class="qb-table-shell">
        <table class="qb-table">
          <thead><tr><th>Name</th><th>Role</th><th>Office</th><th>Status</th><th>Department</th></tr></thead>
          <tbody>
            <tr
              v-for="row in rows" :key="row.name"
              :class="{
                'qb-row--match': matchSet.has(row.name),
                'qb-row--dim': activePairs.length > 0 && !matchSet.has(row.name)
              }"
            >
              <td>{{ row.name }}</td>
              <td>{{ row.role }}</td>
              <td>{{ row.office }}</td>
              <td>{{ row.status }}</td>
              <td>{{ row.dept }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<style scoped>
.qb {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 16px;
  align-items: start;
  margin: 16px 0;
}
@media (max-width: 860px) { .qb { grid-template-columns: 1fr; } }

.qb-left { display: flex; flex-direction: column; gap: 12px; }

.qb-section-label {
  font-size: 0.69rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--vp-c-text-2);
}

/* Code editor */
.qb-editor {
  background: #1e1e1e;
  border: 1px solid #2d2d2d;
  border-radius: 10px;
  padding: 10px 14px;
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 0.76rem;
  line-height: 1.9;
}
.qb-ln { display: flex; align-items: center; flex-wrap: nowrap; }
.qb-ln--pair { gap: 0; }

/* Token colours */
.t-kw     { color: #c586c0; }
.t-fn     { color: #dcdcaa; }
.t-root   { color: #9cdcfe; }
.t-var    { color: #9cdcfe; }
.t-brace  { color: #da70d6; }
.t-punct  { color: #d4d4d4; }
.t-quote  { color: #ce9178; }
.t-dim    { color: #858585; }
.t-indent { white-space: pre; color: #858585; user-select: none; }
.t-err-comment { color: #f87171; font-size: 0.88em; white-space: nowrap; margin-left: 6px; }
.t-suggestion {
  cursor: pointer;
  color: var(--vp-c-brand-1);
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
.t-suggestion:hover { color: #fff; }

/* Inputs inside the editor */
.qb-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.12);
  outline: none;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  padding: 0;
  min-width: 1ch;
  flex-shrink: 0;
  transition: border-color 0.12s;
}
.qb-input:focus { border-bottom-color: rgba(255,255,255,0.35); }

.qb-input--key { color: #9cdcfe; text-align: right; }
.qb-input--key::placeholder { color: #4e6a88; }
.qb-input--key-invalid { color: #f87171; }
.qb-input--key-invalid:focus { border-bottom-color: #f87171; }

.qb-input--val { color: #ce9178; }
.qb-input--val::placeholder { color: #6b4a38; }

.qb-input--cellcol { color: #ce9178; }
.qb-input--cellcol::placeholder { color: #6b4a38; }

.t-cell-result { color: #6a9955; white-space: nowrap; }

/* Delete button */
.qb-del {
  margin-left: 8px;
  width: 16px; height: 16px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  color: #555;
  font-size: 0.8rem;
  line-height: 1;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: color 0.1s, border-color 0.1s;
}
.qb-del:hover { color: #f87171; border-color: rgba(248,113,113,0.4); }

/* Add field button styled as comment */
.qb-add {
  background: transparent; border: none;
  color: #4e7a4e; font-family: inherit; font-size: inherit;
  cursor: pointer; padding: 0;
  transition: color 0.12s;
}
.qb-add:hover { color: #6a9955; }

/* Result */
.qb-result {
  padding: 9px 12px; border-radius: 8px;
  font-size: 0.8rem; display: flex; align-items: flex-start;
  gap: 7px; line-height: 1.45;
}
.qb-result--ok {
  background: color-mix(in srgb, #16a34a 12%, var(--vp-c-bg-soft));
  border: 1px solid color-mix(in srgb, #22c55e 45%, transparent);
}
.qb-result--err {
  background: color-mix(in srgb, #dc2626 9%, var(--vp-c-bg-soft));
  border: 1px solid color-mix(in srgb, #f87171 40%, transparent);
}
.qb-result code { font-size: 0.85em; }
.qb-result--ok code { color: #16a34a; }
.qb-result--err code { color: #f87171; }
.qb-result-icon { flex-shrink: 0; font-size: 0.85rem; margin-top: 1px; }
.qb-error-pre {
  margin: 0; padding: 0;
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem; line-height: 1.55;
  white-space: pre-wrap; word-break: break-word;
  color: inherit;
}
.qb-result--ok .qb-result-icon { color: #16a34a; }
.qb-result--err .qb-result-icon { color: #f87171; }

/* Table */
.qb-table-head { display: flex; align-items: center; gap: 10px; margin-bottom: 7px; }
.qb-badge {
  font-size: 0.71rem; font-weight: 600; padding: 2px 9px; border-radius: 999px;
}
.qb-badge--ok {
  background: color-mix(in srgb, #16a34a 15%, var(--vp-c-bg-soft));
  color: #15803d; border: 1px solid color-mix(in srgb, #22c55e 45%, transparent);
}
.qb-badge--err {
  background: color-mix(in srgb, #dc2626 10%, var(--vp-c-bg-soft));
  color: #b91c1c; border: 1px solid color-mix(in srgb, #f87171 40%, transparent);
}
.qb-table-shell {
  border: 1px solid color-mix(in srgb, var(--vp-c-divider) 85%, transparent);
  border-radius: 10px; overflow: hidden; background: var(--vp-c-bg);
  display: flex; justify-content: center;
}
.qb-table { width: auto; min-width: 260px; border-collapse: collapse; font-size: 0.76rem; }
.qb-table th, .qb-table td {
  padding: 7px 9px;
  border-bottom: 1px solid color-mix(in srgb, var(--vp-c-divider) 70%, transparent);
  text-align: left;
}
.qb-table th {
  background: color-mix(in srgb, var(--vp-c-bg-soft) 80%, var(--vp-c-bg));
  font-weight: 600; font-size: 0.69rem; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--vp-c-text-2);
}
.qb-table tbody tr:last-child td { border-bottom: none; }
.qb-row--match td { background: color-mix(in srgb, #16a34a 12%, var(--vp-c-bg)); transition: background .15s; }
.qb-row--match td:first-child { box-shadow: inset 3px 0 0 #22c55e; }
.qb-row--dim { opacity: 0.3; transition: opacity .15s; }

.qb-fade-enter-active, .qb-fade-leave-active { transition: opacity .18s, transform .18s; }
.qb-fade-enter-from, .qb-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
