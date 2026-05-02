<script setup lang="ts">
import { computed, ref } from 'vue'

type HighlightKey = 'headers' | 'rows' | 'cells'

const active = ref<HighlightKey>('headers')

const configLines: Array<{
  key: HighlightKey
  code: string
  label: string
  detail: string
}> = [
  {
    key: 'headers',
    code: "headerSelector: 'thead th',",
    label: 'Headers are found from the table root.',
    detail: "Smart Table runs the header selector inside the root locator and stores each header's column index."
  },
  {
    key: 'rows',
    code: "rowSelector: 'tbody tr',",
    label: 'Rows are also found from the table root.',
    detail: 'Each matching row becomes a SmartRow that can be searched, asserted, or converted to JSON.'
  },
  {
    key: 'cells',
    code: "cellSelector: 'td'",
    label: 'Cells are found from each row.',
    detail: "When you call row.getCell('Office'), Smart Table uses the column map and resolves cells inside that row."
  }
]

const activeLine = computed(() => configLines.find((line) => line.key === active.value) ?? configLines[0])

function setActive(key: HighlightKey) {
  active.value = key
}
</script>

<template>
  <div class="table-anatomy">
    <section class="config-panel" aria-label="Selector configuration">
      <div class="panel-heading">
        <span class="eyebrow">Config</span>
        <strong>Hover a selector</strong>
      </div>

      <pre class="config-code"><code><span class="muted">const root = page.locator('#employees');</span>
<span class="muted">const table = useTable(root, {</span>
<button
  v-for="line in configLines"
  :key="line.key"
  type="button"
  class="config-line"
  :class="{ active: active === line.key }"
  @focus="setActive(line.key)"
  @mouseenter="setActive(line.key)"
  @click="setActive(line.key)"
>{{ line.code }}</button>
<span class="muted">});</span></code></pre>
    </section>

    <section class="visual-panel" aria-label="Selector scoping preview">
      <div class="panel-heading">
        <span class="eyebrow">Table Root</span>
        <strong>{{ activeLine.label }}</strong>
        <p>{{ activeLine.detail }}</p>
      </div>

      <div class="root-box" :class="{ active: active === 'headers' || active === 'rows' }">
        <table>
          <thead>
            <tr>
              <th :class="{ highlight: active === 'headers' }">Name</th>
              <th :class="{ highlight: active === 'headers' }">Role</th>
              <th :class="{ highlight: active === 'headers' }">Office</th>
              <th :class="{ highlight: active === 'headers' }">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr :class="{ highlight: active === 'rows' }">
              <td :class="{ highlight: active === 'cells' }">Airi Satou</td>
              <td :class="{ highlight: active === 'cells' }">Accountant</td>
              <td :class="{ highlight: active === 'cells' }">Tokyo</td>
              <td :class="{ highlight: active === 'cells' }">Active</td>
            </tr>
            <tr :class="{ highlight: active === 'rows' }">
              <td :class="{ highlight: active === 'cells' }">Brielle Williamson</td>
              <td :class="{ highlight: active === 'cells' }">Integration Specialist</td>
              <td :class="{ highlight: active === 'cells' }">New York</td>
              <td :class="{ highlight: active === 'cells' }">Active</td>
            </tr>
            <tr :class="{ highlight: active === 'rows' }">
              <td :class="{ highlight: active === 'cells' }">Cedric Kelly</td>
              <td :class="{ highlight: active === 'cells' }">Developer</td>
              <td :class="{ highlight: active === 'cells' }">Edinburgh</td>
              <td :class="{ highlight: active === 'cells' }">Review</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.table-anatomy {
  display: grid;
  grid-template-columns: minmax(320px, 0.85fr) minmax(520px, 1.5fr);
  gap: 32px;
  margin: 36px 0;
}

.panel-heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.panel-heading p {
  margin: 0;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

.eyebrow {
  color: var(--vp-c-brand-1);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.config-code {
  margin: 0;
  padding: 18px 0;
  overflow: hidden;
  border-radius: 18px;
  background: #0f172a;
  color: #dbeafe;
  font-size: 0.84rem;
  line-height: 1.75;
}

.config-code code {
  display: block;
  font-family: var(--vp-font-family-mono);
}

.muted {
  display: block;
  padding: 0 20px;
  color: #94a3b8;
}

.config-line {
  display: block;
  width: 100%;
  padding: 1px 20px 1px 34px;
  border: 0;
  border-left: 3px solid transparent;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.config-line:hover,
.config-line:focus,
.config-line.active {
  border-left-color: #60a5fa;
  background: rgba(96, 165, 250, 0.16);
  color: #ffffff;
  outline: none;
}

.root-box {
  padding: 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.root-box.active {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 70%, var(--vp-c-divider));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--vp-c-brand-1) 16%, transparent);
}

table {
  width: 100%;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  font-size: 0.88rem;
}

th,
td {
  padding: 12px;
  border-right: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
  transition: background-color 160ms ease, box-shadow 160ms ease, color 160ms ease;
}

th:last-child,
td:last-child {
  border-right: 0;
}

tbody tr:last-child td {
  border-bottom: 0;
}

th {
  background: color-mix(in srgb, var(--vp-c-brand-1) 10%, var(--vp-c-bg-soft));
  color: var(--vp-c-text-1);
  text-align: left;
}

td {
  color: var(--vp-c-text-2);
}

.highlight,
tr.highlight td {
  background: color-mix(in srgb, var(--vp-c-brand-1) 18%, var(--vp-c-bg-soft));
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--vp-c-brand-1) 54%, transparent);
  color: var(--vp-c-text-1);
}

@media (max-width: 900px) {
  .table-anatomy {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .root-box {
    overflow-x: auto;
  }

  table {
    min-width: 620px;
  }
}
</style>
