<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  label: string
  code: string
}>()

const open = ref(false)
</script>

<template>
  <div class="cs" :class="{ 'cs--open': open }">
    <button class="cs-toggle" @click="open = !open" :aria-expanded="open">
      <span class="cs-icon" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
      <span class="cs-label">{{ label }}</span>
      <span class="cs-tag">config</span>
    </button>
    <transition name="cs-slide">
      <div v-if="open" class="cs-body">
        <pre class="cs-pre"><code>{{ code }}</code></pre>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.cs {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  margin: 10px 0;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.2s;
}
.cs--open { border-color: color-mix(in srgb, var(--vp-c-brand-1) 45%, var(--vp-c-divider)); }

.cs-toggle {
  width: 100%;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--vp-c-text-1);
  transition: background 0.15s;
}
.cs-toggle:hover { background: color-mix(in srgb, var(--vp-c-brand-1) 5%, transparent); }

.cs-icon {
  font-size: 0.72rem; color: var(--vp-c-brand-1);
  width: 12px; flex-shrink: 0;
  transition: transform 0.15s;
}
.cs-label {
  font-size: 0.76rem; font-weight: 600;
  color: var(--vp-c-text-1);
  flex: 1;
}
.cs-tag {
  font-size: 0.60rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 6px; border-radius: 4px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 12%, var(--vp-c-bg));
  color: var(--vp-c-brand-1);
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 28%, transparent);
  flex-shrink: 0;
}

.cs-body { border-top: 1px solid var(--vp-c-divider); }
.cs-pre {
  margin: 0;
  padding: 12px 16px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 0.73rem;
  line-height: 1.55;
  overflow-x: auto;
  white-space: pre;
}

/* Slide transition */
.cs-slide-enter-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.cs-slide-leave-active { transition: opacity 0.12s ease; }
.cs-slide-enter-from  { opacity: 0; transform: translateY(-4px); }
.cs-slide-leave-to    { opacity: 0; }
</style>
