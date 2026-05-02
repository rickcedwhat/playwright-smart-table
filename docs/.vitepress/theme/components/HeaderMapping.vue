<script setup lang="ts">
import { computed, ref } from 'vue'

type HighlightKey = 'headers' | 'fallback' | 'transformer'

const active = ref<HighlightKey>('fallback')

const steps: Array<{
  key: HighlightKey
  code: string
  title: string
  detail: string
}> = [
  {
    key: 'headers',
    code: "headerSelector: 'thead th',",
    title: 'Read the raw header cells',
    detail: 'Smart Table starts with whatever text the UI actually renders.'
  },
  {
    key: 'fallback',
    code: "/* blank header */",
    title: 'Name blank columns automatically',
    detail: 'Empty headers are still addressable with stable fallback names like __col_0.'
  },
  {
    key: 'transformer',
    code: 'headerTransformer: cleanHeader',
    title: 'Normalize UI-only labels',
    detail: 'A transformer can remove sort arrows, percentages, counters, or other display-only text.'
  }
]

const activeStep = computed(() => steps.find((step) => step.key === active.value) ?? steps[0])

function setActive(key: HighlightKey) {
  active.value = key
}
</script>

<template>
  <div class="header-mapping">
    <section class="config-panel" aria-label="Header mapping configuration">
      <div class="panel-heading">
        <span class="eyebrow">Config</span>
        <strong>Hover a mapping rule</strong>
      </div>

      <pre class="config-code"><code><span class="muted">useTable(root, {</span>
<button
  v-for="step in steps"
  :key="step.key"
  type="button"
  class="config-line"
  :class="{ active: active === step.key }"
  @focus="setActive(step.key)"
  @mouseenter="setActive(step.key)"
  @click="setActive(step.key)"
>{{ step.code }}</button>
<span class="muted">});</span></code></pre>
    </section>

    <section class="visual-panel" aria-label="Header mapping preview">
      <div class="panel-heading">
        <span class="eyebrow">Header Map</span>
        <strong>{{ activeStep.title }}</strong>
        <p>{{ activeStep.detail }}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th class="select-col" :class="{ highlight: active === 'headers' || active === 'fallback' }">
              <span class="sr-only">Select row</span>
            </th>
            <th :class="{ highlight: active === 'headers' }">Name</th>
            <th :class="{ highlight: active === 'headers' }">Role</th>
            <th :class="{ highlight: active === 'headers' || active === 'transformer' }">
              Office <span aria-hidden="true">↑</span>
            </th>
            <th :class="{ highlight: active === 'headers' || active === 'transformer' }">
              Status <span aria-hidden="true">%</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="select-col"><input type="checkbox" checked disabled aria-label="Select Airi Satou"></td>
            <td>Airi Satou</td>
            <td>Accountant</td>
            <td>Tokyo</td>
            <td>Active</td>
          </tr>
        </tbody>
      </table>

      <div class="mapping-output" aria-label="Detected column names">
        <div :class="{ active: active === 'fallback' }">
          <span>blank</span>
          <strong>__col_0</strong>
        </div>
        <div>
          <span>Name</span>
          <strong>Name</strong>
        </div>
        <div>
          <span>Role</span>
          <strong>Role</strong>
        </div>
        <div :class="{ active: active === 'transformer' }">
          <span>Office ↑</span>
          <strong>Office</strong>
        </div>
        <div :class="{ active: active === 'transformer' }">
          <span>Status %</span>
          <strong>Status</strong>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.header-mapping {
  display: grid;
  grid-template-columns: minmax(320px, 0.8fr) minmax(560px, 1.6fr);
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
  transition: background-color 160ms ease, box-shadow 160ms ease;
}

td {
  color: var(--vp-c-text-2);
}

.select-col {
  width: 56px;
  text-align: center;
}

.select-col input {
  width: 16px;
  height: 16px;
  accent-color: var(--vp-c-brand-1);
}

.highlight {
  background: color-mix(in srgb, var(--vp-c-brand-1) 18%, var(--vp-c-bg-soft));
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--vp-c-brand-1) 54%, transparent);
}

.mapping-output {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.mapping-output div {
  padding: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  transition: background-color 160ms ease, box-shadow 160ms ease;
}

.mapping-output div.active {
  background: color-mix(in srgb, var(--vp-c-brand-1) 16%, var(--vp-c-bg-soft));
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--vp-c-brand-1) 48%, transparent);
}

.mapping-output span,
.mapping-output strong {
  display: block;
}

.mapping-output span {
  color: var(--vp-c-text-2);
  font-size: 0.78rem;
}

.mapping-output strong {
  margin-top: 4px;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 900px) {
  .header-mapping {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .visual-panel {
    overflow-x: auto;
  }

  table,
  .mapping-output {
    min-width: 680px;
  }
}
</style>
