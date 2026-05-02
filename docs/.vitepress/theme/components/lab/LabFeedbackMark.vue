<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  /** Short slug; full id copied is `lab.{slug}` */
  slug: string
  /** Optional heading shown in tooltip */
  label?: string
  /** Tighter spacing for use inside nested widgets */
  compact?: boolean
}>()

const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

const fullId = computed(() => `lab.${props.slug}`)

const ariaLabel = computed(() =>
  props.label ? `Copy feedback id ${fullId.value} (${props.label})` : `Copy feedback id ${fullId.value}`
)

const hint = computed(() =>
  props.label ? `${props.label} — click to copy ${fullId.value}` : `Click to copy ${fullId.value}`
)

async function copy() {
  const text = fullId.value
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    } catch {
      return
    }
  }
  copied.value = true
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <button
    type="button"
    class="lab-fb"
    :class="{ compact: props.compact }"
    :title="hint"
    :aria-label="ariaLabel"
    @click="copy"
  >
    <!-- Erlenmeyer flask (lab cue); id only in tooltip / screen readers -->
    <svg class="lab-fb-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M10 2h4v4l5.2 11.8H4.8L10 6V2z" />
    </svg>
    <span v-if="copied" class="lab-fb-toast" role="status">Copied</span>
  </button>
</template>

<style scoped>
.lab-fb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0 0.2em;
  padding: 1px;
  width: 1rem;
  height: 1rem;
  border: none;
  border-radius: 4px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 12%, transparent);
  color: color-mix(in srgb, var(--vp-c-brand-1) 88%, var(--vp-c-text-2));
  cursor: pointer;
  font: inherit;
  position: relative;
  vertical-align: -0.14em;
  flex-shrink: 0;
}
.lab-fb:hover {
  background: color-mix(in srgb, var(--vp-c-brand-1) 22%, transparent);
  color: var(--vp-c-brand-1);
}
.lab-fb:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
.lab-fb-icon {
  width: 0.58rem;
  height: 0.58rem;
  display: block;
}
.lab-fb.compact {
  margin-top: 0;
  margin-bottom: 0;
}
.lab-fb-toast {
  position: absolute;
  left: 50%;
  top: calc(100% + 4px);
  transform: translateX(-50%);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.6rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  white-space: nowrap;
  z-index: 2;
  pointer-events: none;
}
</style>
