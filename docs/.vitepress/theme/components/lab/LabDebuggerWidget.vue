<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

type VariableKind = 'json' | 'code' | 'error' | 'text'

export type DebugVariablePane = {
  id: string
  label: string
  revealAtStep: number
  value: string
  kind?: VariableKind
  idleValue?: string
}

export type DebugPaginationButton = {
  label: string
  active?: boolean
  disabled?: boolean
  pulse?: boolean
}

const props = defineProps<{
  headers: string[]
  rows: Array<Record<string, string>>
  codeLines: string[]
  variables: DebugVariablePane[]
  stepNotes?: string[]
  cellClassMap?: Record<string, string>
  paginationButtons?: DebugPaginationButton[]
  persistPreviousContext?: boolean
  title?: string
}>()
const emit = defineEmits<{
  (e: 'step-change', step: number | null): void
}>()

const nextLine = ref(0)
const executed = ref<number[]>([])

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlightLine(source: string): string {
  const strings: string[] = []
  let s = source.replace(/'([^'\\]|\\.)*'/g, (m) => {
    strings.push(`<span class="tok-str">${escapeHtml(m)}</span>`)
    return `__S${strings.length - 1}__`
  })
  s = escapeHtml(s)
  strings.forEach((html, i) => { s = s.replace(`__S${i}__`, html) })
  s = s.replace(/\b(async|await|return)\b/g, '<span class="tok-kw-flow">$1</span>')
  s = s.replace(/\b(const|let|if|for|of)\b/g, '<span class="tok-kw">$1</span>')
  s = s.replace(/\b(table|page)\b/g, '<span class="tok-root">$1</span>')
  s = s.replace(/\b(init|getRow|findRow|getCell|locator|filter|nth|first)\b/g, '<span class="tok-fn">$1</span>')
  s = s.replace(/\b(rowTypo|row|headerMap)\b/g, '<span class="tok-var">$1</span>')
  s = s.replace(/\b(Name|Naem|Role|Office|Status|Select|employees)(\s*:)/g, '<span class="tok-prop">$1</span><span class="tok-punct">$2</span>')
  s = s.replace(/([()[\]{}])/g, '<span class="tok-brace">$1</span>')
  return s
}

type DisplayLine = { id: string; step: number; text: string; isStepStart: boolean }

const displayLines = computed<DisplayLine[]>(() =>
  props.codeLines.flatMap((chunk, step) =>
    chunk.split('\n').map((text, idx) => ({ id: `${step}-${idx}`, step, text, isStepStart: idx === 0 }))
  )
)

const renderedLines = computed(() => displayLines.value.map((l) => highlightLine(l.text)))
const isDone = computed(() => nextLine.value >= props.codeLines.length)
const hasStarted = computed(() => executed.value.length > 0)
const executedSet = computed(() => new Set(executed.value))
const activeStep = computed(() => {
  if (executed.value.length === 0) return null
  const last = executed.value[executed.value.length - 1]
  return typeof last === 'number' ? last : null
})
watch(activeStep, (step) => emit('step-change', step), { immediate: true })

const activeStepNote = computed(() => {
  if (activeStep.value === null) return null
  return props.stepNotes?.[activeStep.value] ?? null
})
const latestVisiblePane = computed(() => {
  if (activeStep.value !== null) {
    const p = props.variables.find((v) => v.revealAtStep === activeStep.value)
    if (p) return p
  }
  if (!props.persistPreviousContext) return null
  for (let i = executed.value.length - 1; i >= 0; i--) {
    const p = props.variables.find((v) => v.revealAtStep === executed.value[i])
    if (p) return p
  }
  return null
})
const latestVisiblePaneValue = computed(() => (latestVisiblePane.value ? paneValue(latestVisiblePane.value) : ''))

const activeDisplayLineIndex = computed(() => {
  if (activeStep.value === null) return 0
  const idx = displayLines.value.findIndex((l) => l.step === activeStep.value && l.isStepStart)
  return idx < 0 ? 0 : idx
})

// --- Floating popover (teleported to body, position: fixed) ---
const snippetEl = ref<HTMLElement | null>(null)
const popStyle = ref<Record<string, string>>({ top: '-9999px', right: '-9999px', visibility: 'hidden' })
const useInlinePopover = ref(false)

function repositionPopover(): void {
  const snip = snippetEl.value
  if (!snip || activeStep.value === null) return

  useInlinePopover.value = window.innerWidth <= 980

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const snip2 = snippetEl.value
      if (!snip2 || activeStep.value === null) return
      const wraps = snip2.querySelectorAll<HTMLElement>('.dbg-line-wrap')
      const anchor = wraps[activeDisplayLineIndex.value]
      if (!anchor) return
      const lineWrapRect = anchor.getBoundingClientRect()
      // Notch: upward triangle at top-right, CSS right:14px, 9px border each side → center 23px from right edge
      // Align notch center x with the code text start (padding-left: 40px)
      const codeTextLeft = lineWrapRect.left + 40
      const notchCenterFromRight = 14 + 9  // right offset + half notch width
      const right = window.innerWidth - codeTextLeft - notchCenterFromRight
      // Notch height = 15px (border-bottom-width). Place popover so notch tip touches line bottom.
      const notchHeight = 15
      const top = lineWrapRect.bottom + 4 + notchHeight
      popStyle.value = {
        top: `${Math.round(top)}px`,
        right: `${Math.round(right)}px`,
        visibility: 'visible',
      }
    })
  })
}

let reposScheduled = false
function scheduleRepos() {
  if (reposScheduled) return
  reposScheduled = true
  requestAnimationFrame(() => { reposScheduled = false; repositionPopover() })
}

watch([activeStep, activeDisplayLineIndex], scheduleRepos)
onMounted(() => {
  scheduleRepos()
  window.addEventListener('resize', scheduleRepos)
  window.addEventListener('scroll', scheduleRepos, true)
})
onUnmounted(() => {
  window.removeEventListener('resize', scheduleRepos)
  window.removeEventListener('scroll', scheduleRepos, true)
})

// ---
const advanceIcon = computed(() => !hasStarted.value ? '▶' : isDone.value ? '✓' : '⏭')
const advanceLabel = computed(() => !hasStarted.value ? 'Play' : isDone.value ? 'Playback complete' : `Run line ${nextLine.value + 1}`)

function stepLine() {
  if (isDone.value) return
  if (!executedSet.value.has(nextLine.value)) executed.value = [...executed.value, nextLine.value]
  nextLine.value += 1
}
function resetDebugger() { nextLine.value = 0; executed.value = [] }
function paneValue(p: DebugVariablePane): string {
  return executedSet.value.has(p.revealAtStep) ? p.value : (p.idleValue ?? '{}')
}
function cellClass(rowIndex: number, header: string): string {
  return props.cellClassMap?.[`${rowIndex}:${header}`] ?? ''
}
</script>

<template>
  <div class="dbg">
    <div class="dbg-head">
      <strong>{{ title ?? 'Debugger widget' }}</strong>
      <div class="dbg-inline-actions">
        <button type="button" class="dbg-icon-btn dbg-icon-btn--play" @click="stepLine" :disabled="isDone" :aria-label="advanceLabel" :title="advanceLabel">
          <span aria-hidden="true">{{ advanceIcon }}</span>
        </button>
        <button type="button" class="dbg-icon-btn" @click="resetDebugger" aria-label="Reset playback" title="Reset playback">
          <span aria-hidden="true">↺</span>
        </button>
      </div>
    </div>

    <div class="dbg-main">
      <div ref="snippetEl" class="dbg-snippet">
        <div class="dbg-label">Snippet</div>
        <pre class="dbg-pre"><code class="dbg-code"><span
            v-for="(line, i) in renderedLines"
            :key="displayLines[i].id"
            class="dbg-line-wrap"
          ><span
            class="dbg-line"
            :class="{
              'dbg-line--done': executedSet.has(displayLines[i].step),
              'dbg-line--paused': activeStep === displayLines[i].step,
              'dbg-line--dim': activeStep !== displayLines[i].step && !executedSet.has(displayLines[i].step)
            }"
          ><span class="dbg-gutter">{{ i + 1 }}</span><span class="dbg-pointer">{{
            displayLines[i].isStepStart ? (activeStep === displayLines[i].step ? '▶' : executedSet.has(displayLines[i].step) ? '✓' : '') : ''
          }}</span><span v-html="line"></span>
          </span></span></code></pre>

        <!-- Inline fallback for narrow viewports -->
        <transition name="dbg-ctx">
          <div v-if="activeStep !== null && useInlinePopover" class="dbg-inline-pop">
            <div v-if="latestVisiblePane" class="dbg-popover" :class="{ 'dbg-popover--err': latestVisiblePane.kind === 'error' }">
              <div class="dbg-popover-head"><span class="dbg-popover-label">{{ latestVisiblePane.label }}</span></div>
              <pre class="dbg-popover-pre"><code>{{ latestVisiblePaneValue }}</code></pre>
            </div>
            <p v-if="activeStepNote" class="dbg-ctx-note">{{ activeStepNote }}</p>
          </div>
        </transition>
      </div>

      <div class="dbg-table-wrap">
        <div class="dbg-table-card">
          <table class="dbg-table" aria-label="Widget table">
            <thead><tr><th v-for="h in headers" :key="h">{{ h }}</th></tr></thead>
            <tbody>
              <tr v-for="(row, ri) in rows" :key="ri">
                <td v-for="h in headers" :key="h" :class="cellClass(ri, h)">{{ row[h] }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="(paginationButtons?.length ?? 0) > 0" class="dbg-pagination" aria-label="Pagination controls">
            <button v-for="(btn, idx) in paginationButtons" :key="`${btn.label}-${idx}`" type="button" class="dbg-pagination-btn"
              :class="{ 'dbg-pagination-btn--active': btn.active, 'dbg-pagination-btn--pulse': btn.pulse }" :disabled="btn.disabled">
              {{ btn.label }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Floating popover: teleported to body, position fixed, to the left of snippet -->
  <Teleport to="body">
    <transition name="dbg-pop">
      <div v-if="activeStep !== null && !useInlinePopover" class="dbg-float-pop" :style="popStyle">
        <div v-if="latestVisiblePane" class="dbg-popover" :class="{ 'dbg-popover--err': latestVisiblePane.kind === 'error' }">
          <div class="dbg-popover-head"><span class="dbg-popover-label">{{ latestVisiblePane.label }}</span></div>
          <pre class="dbg-popover-pre"><code>{{ latestVisiblePaneValue }}</code></pre>
        </div>
        <p v-if="activeStepNote" class="dbg-ctx-note">{{ activeStepNote }}</p>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.dbg { margin: 14px 0; padding: 12px; border: 1px solid var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg-soft); }
.dbg-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
.dbg-inline-actions { display: inline-flex; align-items: center; gap: 6px; }
.dbg-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--vp-c-text-2); margin-bottom: 4px; letter-spacing: 0.05em; }

.dbg-main {
  display: grid;
  grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
  align-items: start;
  gap: 0 14px;
}

.dbg-snippet { width: fit-content; max-width: 100%; min-width: 0; }

.dbg-table-wrap { display: flex; justify-content: end; align-items: flex-start; }
.dbg-table-card { border: 1px solid color-mix(in srgb, var(--vp-c-divider) 85%, transparent); border-radius: 8px; overflow: hidden; background: var(--vp-c-bg); }
.dbg-table { width: auto; border-collapse: collapse; font-size: 0.76rem; }
.dbg-table th, .dbg-table td { padding: 7px 9px; border-bottom: 1px solid color-mix(in srgb, var(--vp-c-divider) 70%, transparent); text-align: left; }
.dbg-table th { background: color-mix(in srgb, var(--vp-c-bg-soft) 80%, var(--vp-c-bg)); font-weight: 600; }
.dbg-table tbody tr:last-child td { border-bottom: none; }
.dbg-table td.dbg-cell--miss { background: color-mix(in srgb, #ef4444 18%, transparent); color: #fecaca; }
.dbg-table td.dbg-cell--match { background: color-mix(in srgb, #22c55e 24%, transparent); color: #bbf7d0; font-weight: 600; }

.dbg-pagination { display: flex; gap: 6px; justify-content: center; padding: 8px 8px 10px; border-top: 1px solid color-mix(in srgb, var(--vp-c-divider) 72%, transparent); background: color-mix(in srgb, var(--vp-c-bg-soft) 60%, var(--vp-c-bg)); }
.dbg-pagination-btn { min-width: 24px; height: 22px; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--vp-c-divider) 82%, transparent); background: color-mix(in srgb, var(--vp-c-bg) 84%, transparent); color: var(--vp-c-text-2); font-size: 0.66rem; line-height: 1; padding: 0 7px; }
.dbg-pagination-btn--active { border-color: color-mix(in srgb, var(--vp-c-brand-1) 65%, var(--vp-c-divider)); color: var(--vp-c-brand-1); }
.dbg-pagination-btn--pulse { animation: dbg-pagination-click .28s ease; }
@keyframes dbg-pagination-click {
  0% { transform: translateY(0); }
  35% { transform: translateY(1px) scale(0.97); background: color-mix(in srgb, var(--vp-c-brand-1) 28%, var(--vp-c-bg)); }
  100% { transform: translateY(0) scale(1); }
}

.dbg-icon-btn { width: 23px; height: 23px; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--vp-c-divider) 88%, transparent); background: color-mix(in srgb, var(--vp-c-bg) 82%, transparent); color: var(--vp-c-text-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: .8rem; line-height: 1; transition: border-color .15s ease, color .15s ease, background .15s ease; }
.dbg-icon-btn--play { color: var(--vp-c-brand-1); border-color: color-mix(in srgb, var(--vp-c-brand-1) 62%, var(--vp-c-divider)); }
.dbg-icon-btn:hover { border-color: color-mix(in srgb, var(--vp-c-brand-1) 52%, var(--vp-c-divider)); }
.dbg-icon-btn:disabled { opacity: .55; cursor: not-allowed; }

.dbg-pre { margin: 0; width: max-content; max-width: min(100%, 88vw); padding: 7px 10px; border-radius: 8px; background: #1e1e1e; color: #d4d4d4; border: 1px solid #2d2d2d; font-family: ui-monospace, 'SF Mono', Menlo, Monaco, 'Cascadia Code', Consolas, monospace; font-size: 0.73rem; line-height: 1.14; overflow-x: auto; }
.dbg-line-wrap { display: block; }
.dbg-line { display: block; margin: 0 -4px; padding: 0 0 0 40px; border-radius: 4px; position: relative; transition: background .15s ease, opacity .15s ease; }
.dbg-line--dim { opacity: .42; }
.dbg-line--paused { background: rgba(86,156,214,.16); }
.dbg-line--done { opacity: .9; }
.dbg-gutter { position: absolute; left: 0; width: 22px; text-align: right; font-size: .58rem; color: #858585; padding-right: 7px; }
.dbg-pointer { position: absolute; left: 24px; width: 12px; color: #89ddff; font-size: .58rem; }
.dbg-code :deep(.tok-kw) { color: #4fc1ff; }
.dbg-code :deep(.tok-kw-flow) { color: #c792ea; }
.dbg-code :deep(.tok-fn) { color: #e6db74; }
.dbg-code :deep(.tok-root), .dbg-code :deep(.tok-var), .dbg-code :deep(.tok-prop) { color: #7fdbff; }
.dbg-code :deep(.tok-str) { color: #ffb88a; }
.dbg-code :deep(.tok-punct) { color: #d4d4d4; }
.dbg-code :deep(.tok-brace) { color: #da70d6; }

/* Shared popover card */
.dbg-popover { border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg); box-shadow: 0 2px 10px rgba(2,6,23,.12); width: 100%; box-sizing: border-box; }
.dbg-popover--err { border-color: color-mix(in srgb, #f87171 55%, var(--vp-c-divider)); }
.dbg-popover-head { display: flex; align-items: center; padding: 7px 10px 5px; }
.dbg-popover-label { font-size: .68rem; letter-spacing: .05em; text-transform: uppercase; color: var(--vp-c-brand-1); }
.dbg-popover-pre { margin: 0; padding: 0 10px 9px; color: #c3e88d; font-family: ui-monospace, Menlo, Monaco, monospace; font-size: .69rem; line-height: 1.35; white-space: pre-wrap; overflow-x: hidden; width: 100%; box-sizing: border-box; }
.dbg-popover--err .dbg-popover-pre { color: #fca5a5; }
.dbg-ctx-note { margin: 0; font-size: .72rem; line-height: 1.38; color: var(--vp-c-text-2); }

/* Inline fallback (narrow viewports) */
.dbg-inline-pop { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; padding: 8px 10px; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg-soft); }

/* Transitions */
.dbg-ctx-enter-active, .dbg-ctx-leave-active { transition: opacity .18s ease; }
.dbg-ctx-enter-from, .dbg-ctx-leave-to { opacity: 0; }
.dbg-pop-enter-active, .dbg-pop-leave-active { transition: opacity .16s ease, transform .16s ease; }
.dbg-pop-enter-from, .dbg-pop-leave-to { opacity: 0; transform: translateY(-4px); }

@media (max-width: 980px) {
  .dbg-main { grid-template-columns: 1fr; gap: 12px; }
  .dbg-snippet { width: 100%; }
  .dbg-pre { width: 100%; max-width: 100%; }
  .dbg-table-wrap { justify-content: start; }
}
</style>

<!-- Floating popover styles: not scoped so they apply to the teleported element -->
<style>
.dbg-float-pop {
  position: fixed;
  z-index: 200;
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--vp-c-divider);
  outline: 2px solid color-mix(in srgb, var(--vp-c-brand-1) 65%, transparent);
  outline-offset: 0;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  box-shadow: 0 4px 20px rgba(2, 6, 23, 0.22);
  box-sizing: border-box;
}
/* Upward-pointing notch at top-right corner */
.dbg-float-pop::before,
.dbg-float-pop::after {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
  pointer-events: none;
  top: 0;
  transform: translateY(-100%);
}
.dbg-float-pop::before {
  right: 14px;
  z-index: 1;
  border-width: 0 9px 15px 9px;
  border-color: transparent transparent color-mix(in srgb, var(--vp-c-brand-1) 65%, transparent) transparent;
}
.dbg-float-pop::after {
  right: 15px;
  z-index: 2;
  border-width: 0 8px 13px 8px;
  border-color: transparent transparent var(--vp-c-bg-soft) transparent;
}
</style>
