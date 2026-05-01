<script setup lang="ts">
import { ref } from 'vue'

type Key = 'sentinel' | 'column' | 'pages'

const active = ref<Key>('sentinel')

const items: { key: Key; label: string; code: string; note: string }[] = [
  {
    key: 'sentinel',
    label: 'Row not found',
    code: `const row = table.getRow({ Name: 'Nobody' });
await expect(row).not.toBeVisible();`,
    note: 'Sentinel row: valid Locator, no DOM match.'
  },
  {
    key: 'column',
    label: 'Unknown column',
    code: `row.getCell('DoesNotExist')`,
    note: 'Throws when the column is not in the header map.'
  },
  {
    key: 'pages',
    label: 'Pagination exhausted',
    code: `await table.findRow({ ... }, { maxPages: 1 })`,
    note: 'Returns sentinel when no match within maxPages.'
  }
]
</script>

<template>
  <div class="lab-fail">
    <div class="tabs">
      <LabFeedbackMark slug="failure-states.tabs" label="Failure tabs" compact />
      <button
        v-for="i in items"
        :key="i.key"
        type="button"
        :class="{ on: active === i.key }"
        @click="active = i.key"
      >
        {{ i.label }}
      </button>
    </div>
    <div v-for="i in items" v-show="active === i.key" :key="i.key + 'b'" class="body">
      <div class="body-with-fb">
        <LabFeedbackMark :slug="`failure-states.tab-${i.key}`" :label="i.label" compact />
        <div class="body-main">
          <pre><code>{{ i.code }}</code></pre>
          <p>{{ i.note }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab-fail {
  margin: 20px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  overflow: hidden;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 10px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.tabs button {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  cursor: pointer;
  font-size: 0.82rem;
}
.tabs button.on {
  border-color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 14%, var(--vp-c-bg-soft));
}
.body {
  padding: 14px;
}
.body-with-fb {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.body-main {
  flex: 1;
  min-width: 0;
}
.body-main pre {
  margin: 0 0 10px;
  padding: 12px;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 10px;
  font-size: 0.74rem;
  white-space: pre-wrap;
}
.body-main p {
  margin: 0;
  font-size: 0.88rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}
</style>
