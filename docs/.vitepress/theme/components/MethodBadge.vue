<script setup lang="ts">
defineProps<{ type: 'async' | 'sync' }>()
</script>

<template>
  <span class="mb" :class="`mb--${type}`">{{ type }}</span>
</template>

<style scoped>
.mb {
  display: inline-block;
  font-size: 0.63rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 1px 6px;
  border-radius: 4px;
  vertical-align: middle;
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
  line-height: 1.7;
  position: relative;
  top: -1px;
  white-space: nowrap;
  user-select: none;
}
.mb--async {
  background: color-mix(in srgb, #c586c0 14%, var(--vp-c-bg-soft));
  color: #c586c0;
  border: 1px solid color-mix(in srgb, #c586c0 32%, transparent);
}
.mb--sync {
  background: color-mix(in srgb, #9cdcfe 12%, var(--vp-c-bg-soft));
  color: #569cd6;
  border: 1px solid color-mix(in srgb, #569cd6 28%, transparent);
}
</style>
