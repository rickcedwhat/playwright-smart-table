<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'

type Key = 'init' | 'headers' | 'find' | 'cell'

const active = ref<Key>('init')

const logs: Record<Key, string[]> = {
  init: [
    '[SmartTable] [verbose] init: resolving root locator',
    '[SmartTable] [verbose] table scoped to #employees'
  ],
  headers: [
    '[SmartTable] [verbose] headerSelector matched 4 th cells',
    '[SmartTable] [verbose] column map: Name, Role, Office, Status'
  ],
  find: [
    '[SmartTable] [verbose] findRow: scanning page 1',
    '[SmartTable] [verbose] findRow: no match, goNext()',
    '[SmartTable] [verbose] findRow: scanning page 2 — match'
  ],
  cell: [
    "[SmartTable] [verbose] getCell: column Office → index 2",
    '[SmartTable] [verbose] cell locator resolved under row'
  ]
}

const lines = computed(() => logs[active.value])

const triggers: { key: Key; label: string }[] = [
  { key: 'init', label: 'useTable(...).init()' },
  { key: 'headers', label: 'Header map' },
  { key: 'find', label: 'findRow loop' },
  { key: 'cell', label: 'getCell' }
]
</script>

<template>
  <div class="lab-debug">
    <div class="triggers-wrap">
      <LabFeedbackMark slug="debug-playback.triggers" label="Log scenario buttons" compact />
      <div class="triggers">
        <button
          v-for="t in triggers"
          :key="t.key"
          type="button"
          :class="{ on: active === t.key }"
          @mouseenter="active = t.key"
          @focus="active = t.key"
          @click="active = t.key"
        >
          {{ t.label }}
        </button>
      </div>
    </div>
    <div class="console">
      <div class="console-top">
        <LabFeedbackMark slug="debug-playback.console" label="Fake verbose log" compact />
      </div>
      <div class="console-lines" aria-label="Sample verbose log output">
        <div v-for="(line, i) in lines" :key="i" class="log-line">{{ line }}</div>
      </div>
    </div>
    <p class="disclaimer">
      Illustrative lines; enable <code>debug: { logLevel: 'verbose' }</code> for real output. See
      <a :href="withBase('/guide/debugging')">Debugging</a>.
    </p>
  </div>
</template>

<style scoped>
.lab-debug {
  margin: 20px 0;
}
.triggers-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.triggers {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 0;
}
.triggers button {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-size: 0.8rem;
  cursor: pointer;
}
.triggers button.on,
.triggers button:hover {
  border-color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 12%, var(--vp-c-bg-soft));
}
.console {
  padding: 0;
  border-radius: 12px;
  background: #020617;
  color: #94a3b8;
  font-family: var(--vp-font-family-mono);
  font-size: 0.74rem;
  line-height: 1.65;
  overflow: hidden;
}
.console-top {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}
.console-top :deep(.lab-fb) {
  background: rgba(148, 163, 184, 0.18);
  color: #e2e8f0;
}
.console-top :deep(.lab-fb:hover) {
  background: rgba(148, 163, 184, 0.28);
  color: #f8fafc;
}
.console-lines {
  padding: 14px;
  min-height: 100px;
}
.log-line {
  border-left: 2px solid color-mix(in srgb, var(--vp-c-brand-1) 50%, transparent);
  padding-left: 10px;
  margin-bottom: 6px;
}
.disclaimer {
  margin: 10px 0 0;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
</style>
