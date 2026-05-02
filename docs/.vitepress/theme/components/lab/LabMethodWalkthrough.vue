<script setup lang="ts">
import { computed, ref } from 'vue'

type Key = 'getRow' | 'findRow' | 'findRows' | 'iterate'

const active = ref<Key>('getRow')

const steps: Array<{
  key: Key
  code: string
  title: string
  detail: string
}> = [
  {
    key: 'getRow',
    code: 'table.getRow({ Name: "Airi" })',
    title: 'Current page only',
    detail: 'Resolves immediately against visible rows. Synchronous after init().'
  },
  {
    key: 'findRow',
    code: 'await table.findRow({ Name: "X" }, { maxPages: 5 })',
    title: 'Search across pages',
    detail: 'Uses pagination strategy until a match or maxPages.'
  },
  {
    key: 'findRows',
    code: 'await table.findRows({ Status: "Active" })',
    title: 'Collect every match',
    detail: 'Can return multiple SmartRows across pages.'
  },
  {
    key: 'iterate',
    code: 'await table.map(...) / forEach(...)',
    title: 'Visit all rows',
    detail: 'Deterministic iteration with optional concurrency.'
  }
]

const line = computed(() => steps.find((s) => s.key === active.value) ?? steps[0])
</script>

<template>
  <div class="lab-method">
    <div class="code-col">
      <div class="col-heading">
        <strong>Hover a call</strong>
        <LabFeedbackMark slug="method-walkthrough.code-column" label="Code column" compact />
      </div>
      <pre><code><button
          v-for="s in steps"
          :key="s.key"
          type="button"
          :class="{ on: active === s.key }"
          @mouseenter="active = s.key"
          @focus="active = s.key"
        >{{ s.code }}</button></code></pre>
    </div>
    <div class="visual-col">
      <p class="hint">
        <span>{{ line.title }}</span>
        <LabFeedbackMark slug="method-walkthrough.visual" label="Mini table / narrative" compact />
      </p>
      <p class="detail">{{ line.detail }}</p>
      <div class="mini-table">
        <div class="hdr">Name · Office · Status</div>
        <div
          class="r"
          :class="{
            h1: active === 'getRow' || active === 'findRow',
            h2: active === 'findRows' || active === 'iterate',
            h3: active === 'iterate'
          }"
        >
          Airi · Tokyo · Active
        </div>
        <div class="r" :class="{ h2: active === 'findRows' || active === 'iterate', h3: active === 'iterate' }">
          Brielle · NYC · Active
        </div>
        <div class="r" :class="{ h3: active === 'iterate' }">Cedric · Edinburgh · Review</div>
        <div v-if="active === 'findRow'" class="pagination-indicator">page 2 ▸</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab-method {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin: 20px 0;
}
@media (max-width: 720px) {
  .lab-method {
    grid-template-columns: 1fr;
  }
}
.code-col .col-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.code-col .col-heading strong {
  line-height: 1.2;
}
pre {
  margin: 0;
  padding: 14px;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 12px;
  font-size: 0.78rem;
}
button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  margin-bottom: 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-family: var(--vp-font-family-mono);
  cursor: pointer;
}
button.on,
button:hover {
  background: rgba(96, 165, 250, 0.2);
}
.hint {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-weight: 600;
  margin: 0 0 6px;
}
.hint span {
  line-height: 1.2;
}
.detail {
  margin: 0 0 12px;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}
.mini-table {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
}
.hdr {
  padding: 8px 12px;
  font-size: 0.75rem;
  background: color-mix(in srgb, var(--vp-c-brand-1) 12%, var(--vp-c-bg-soft));
}
.r {
  padding: 8px 12px;
  font-size: 0.85rem;
  border-top: 1px solid var(--vp-c-divider);
  transition: background 0.15s;
}
.r.h1,
.r.h2,
.r.h3 {
  background: color-mix(in srgb, var(--vp-c-brand-1) 14%, var(--vp-c-bg-soft));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vp-c-brand-1) 35%, transparent);
}
.pagination-indicator {
  padding: 6px 12px;
  font-size: 0.75rem;
  text-align: right;
  color: var(--vp-c-brand-1);
  border-top: 1px solid var(--vp-c-divider);
}
</style>
