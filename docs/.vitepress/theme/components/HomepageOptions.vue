<script setup lang="ts">
import { ref, onMounted } from 'vue'
import OptionA from '../homepage/option-a.md'
import OptionB from '../homepage/option-b.md'
import OptionC from '../homepage/option-c.md'

const STORE_KEY = '__homepage_option'
const current = ref(0)

onMounted(() => {
  const saved = localStorage.getItem(STORE_KEY)
  if (saved !== null) current.value = parseInt(saved)
})

function pick(n: number) {
  current.value = n
  localStorage.setItem(STORE_KEY, String(n))
}

const options = [
  { label: 'A', desc: 'Problem → proof → explain' },
  { label: 'B', desc: 'Build up → compare' },
  { label: 'C', desc: 'Leanest — cut the middle' },
]
</script>

<template>
  <div class="hp-options">
    <div class="hp-picker">
      <span class="hp-label">Homepage draft:</span>
      <button
        v-for="(opt, i) in options"
        :key="i"
        :class="['hp-btn', { active: current === i }]"
        @click="pick(i)"
      >
        {{ opt.label }}
        <span class="hp-desc">{{ opt.desc }}</span>
      </button>
    </div>

    <OptionA v-if="current === 0" />
    <OptionB v-if="current === 1" />
    <OptionC v-if="current === 2" />
  </div>
</template>

<style scoped>
.hp-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 32px;
  padding: 10px 14px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  flex-wrap: wrap;
}
.hp-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  margin-right: 4px;
}
.hp-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.hp-btn:hover { background: var(--vp-c-bg-mute); }
.hp-btn.active {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.hp-desc {
  font-size: 11px;
  font-weight: 400;
  color: var(--vp-c-text-3);
}
.hp-btn.active .hp-desc { color: var(--vp-c-brand-2); }
</style>
