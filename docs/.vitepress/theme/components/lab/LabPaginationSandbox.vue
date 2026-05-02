<script setup lang="ts">
import { ref, computed } from 'vue'

// ── Data: 100 pages × 5 rows ──────────────────────────────────────────────
const ROLES   = ['Accountant', 'Engineer', 'Manager', 'Director', 'Analyst']
const OFFICES = ['Tokyo', 'London', 'Berlin', 'Sydney', 'Paris', 'NYC', 'Singapore']
const allRows = Array.from({ length: 500 }, (_, i) => ({
  name:   `Employee ${String(i + 1).padStart(3, '0')}`,
  role:   ROLES[i % ROLES.length],
  office: OFFICES[i % OFFICES.length],
}))

const PAGE_SIZE   = 5
const TOTAL_PAGES = 100
const BULK_N      = 10

// ── Type selection ────────────────────────────────────────────────────────
type PType = 'page-buttons' | 'load-more' | 'infinite-scroll'
const ptype = ref<PType>('page-buttons')

// ── Selector toggles (page-buttons only) ─────────────────────────────────
const togFirst    = ref(true)
const togNextBulk = ref(true)
const togPrevBulk = ref(true)
const togPageNums = ref(true)

function onToggle() { clearPlan() }

// ── Page state ────────────────────────────────────────────────────────────
const page      = ref(1)
const loadedPgs = ref(1)

function switchType(t: PType) { ptype.value = t; page.value = 1; loadedPgs.value = 1; clearPlan() }

const libPage  = computed(() => ptype.value === 'page-buttons' ? page.value : loadedPgs.value)
const canNext  = computed(() => page.value < TOTAL_PAGES)
const canPrev  = computed(() => page.value > 1)
const hasMore  = computed(() => loadedPgs.value < TOTAL_PAGES)

const tableRows = computed(() => {
  if (ptype.value !== 'page-buttons') return allRows.slice(0, loadedPgs.value * PAGE_SIZE)
  return allRows.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
})

// ── Plan ──────────────────────────────────────────────────────────────────
type StepType = 'goFirst' | 'goNext' | 'goPrev' | 'goNextBulk' | 'goPrevBulk' | 'goPage'
interface PlanStep { type: StepType; targetPage: number; done: boolean }

const plan      = ref<PlanStep[]>([])
const stepIdx   = ref(-1)
const planError = ref('')
const planInfo  = ref('')
const targetPg  = ref(50)
const flashBtn        = ref<StepType | null>(null)
const flashTargetPage = ref(-1)
const isExec    = ref(false)
const execTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const STEP_META: Record<StepType, { label: string; btn: string; color: string }> = {
  goFirst:    { label: 'Jump to first',          btn: '|< First', color: '#818cf8' },
  goNext:     { label: 'Next page',              btn: 'Next →',   color: '#60a5fa' },
  goPrev:     { label: 'Previous page',          btn: '← Prev',   color: '#60a5fa' },
  goNextBulk: { label: `Skip +${BULK_N} pages`,  btn: '>>',       color: '#a78bfa' },
  goPrevBulk: { label: `Skip −${BULK_N} pages`,  btn: '<<',       color: '#a78bfa' },
  goPage:     { label: 'Click page number',      btn: '#',        color: '#34d399' },
}

function clearPlan() {
  if (execTimer.value) { clearTimeout(execTimer.value); execTimer.value = null }
  plan.value = []; stepIdx.value = -1; planError.value = ''; planInfo.value = ''
}

// Window index: pages 1-10 → 0, 11-20 → 1, etc.
function windowOf(p: number) { return Math.floor((p - 1) / BULK_N) }

// Page-number window shown in the pager (10 buttons, decade-aligned)
const pageWindow = computed(() => {
  const start = windowOf(page.value) * BULK_N + 1
  const end   = Math.min(start + BULK_N - 1, TOTAL_PAGES)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})

function buildForward(from: number, to: number): PlanStep[] {
  const steps: PlanStep[] = []
  let cur = from
  while (cur < to) {
    if (togNextBulk.value && cur + BULK_N <= to) {
      cur += BULK_N; steps.push({ type: 'goNextBulk', targetPage: cur, done: false })
    } else {
      cur++; steps.push({ type: 'goNext', targetPage: cur, done: false })
    }
  }
  return steps
}

// Navigate forward until we're in the target window (may overshoot within it — that's fine)
function buildForwardToWindow(from: number, toWin: number): PlanStep[] {
  const steps: PlanStep[] = []
  let cur = from
  while (windowOf(cur) < toWin) {
    if (togNextBulk.value) {
      cur += BULK_N; steps.push({ type: 'goNextBulk', targetPage: Math.min(cur, TOTAL_PAGES), done: false })
    } else {
      cur++; steps.push({ type: 'goNext', targetPage: cur, done: false })
    }
  }
  return steps
}

const planHeadLabel = computed(() => {
  if (ptype.value === 'load-more')      return 'Load up to page'
  if (ptype.value === 'infinite-scroll') return 'Scroll down to page'
  return 'Navigate to page'
})

function computePlan() {
  clearPlan()
  const from = libPage.value
  const to   = targetPg.value
  if (to < 1 || to > TOTAL_PAGES) { planError.value = `Page must be 1–${TOTAL_PAGES}`; return }
  if (from === to) { planError.value = 'Already on that page'; return }

  // ── Load-more / infinite-scroll: forward-only append ────────────────────
  if (ptype.value !== 'page-buttons') {
    if (to < from) {
      if (ptype.value === 'infinite-scroll') {
        planInfo.value = `Page ${to} is already loaded — scroll up to find it`
      } else {
        planInfo.value = `Already loaded up to page ${from} — content is visible above`
      }
      return
    }
    const steps: PlanStep[] = []
    for (let i = from; i < to; i++) {
      steps.push({ type: 'goNext', targetPage: i + 1, done: false })
    }
    plan.value = steps
    stepIdx.value = 0
    return
  }

  let steps: PlanStep[] | null = null

  if (togPageNums.value) {
    // With page numbers: navigate to the target window, then click the page number directly
    const fromWin   = windowOf(from)
    const toWin     = windowOf(to)
    const goPageStep: PlanStep = { type: 'goPage', targetPage: to, done: false }

    if (fromWin === toWin) {
      // Already in the right window — one click
      steps = [goPageStep]
    } else if (toWin > fromWin) {
      // Forward: bulk-advance into target window, then click
      steps = [...buildForwardToWindow(from, toWin), goPageStep]
    } else {
      // Backward — Option A: goFirst + forward to window
      let optA: PlanStep[] | null = null
      if (togFirst.value) {
        optA = [{ type: 'goFirst', targetPage: 1, done: false }, ...buildForwardToWindow(1, toWin), goPageStep]
      }
      // Option B: goPrevBulk (or goPrev) until in target window
      let optB: PlanStep[] | null = []
      let cur = from
      while (windowOf(cur) > toWin) {
        if (togPrevBulk.value) {
          cur = Math.max(cur - BULK_N, 1)
          optB.push({ type: 'goPrevBulk', targetPage: cur, done: false })
        } else {
          cur--
          optB.push({ type: 'goPrev', targetPage: cur, done: false })
        }
        if (cur < 1) { optB = null; break }
      }
      if (optB) optB.push(goPageStep)

      if (!optA && !optB) { planError.value = "Enable 'first' or 'previous' to navigate backward"; return }
      steps = optA && optB ? (optA.length <= optB.length ? optA : optB) : (optA ?? optB)
    }
  } else {
    // Without page numbers: step-by-step navigation
    if (to > from) {
      steps = buildForward(from, to)
    } else {
      let optA: PlanStep[] | null = null
      if (togFirst.value) {
        optA = [{ type: 'goFirst', targetPage: 1, done: false }, ...buildForward(1, to)]
      }
      let optB: PlanStep[] | null = []
      let cur = from
      while (cur > to) {
        if (togPrevBulk.value && cur - BULK_N >= to) {
          cur -= BULK_N; optB.push({ type: 'goPrevBulk', targetPage: cur, done: false })
        } else {
          cur--; optB.push({ type: 'goPrev', targetPage: cur, done: false })
        }
      }
      if (cur !== to) optB = null

      if (!optA && !optB) { planError.value = "Enable 'previous' or 'first' to navigate backward"; return }
      steps = optA && optB ? (optA.length <= optB.length ? optA : optB) : (optA ?? optB)
    }
  }

  plan.value = steps!
  stepIdx.value = 0
}

function applyStep(step: PlanStep) {
  flashBtn.value = step.type
  flashTargetPage.value = step.targetPage
  setTimeout(() => { flashBtn.value = null; flashTargetPage.value = -1 }, 320)
  if (ptype.value === 'page-buttons') page.value = step.targetPage
  else loadedPgs.value = step.targetPage
  step.done = true
  stepIdx.value++
}

function executeStep() {
  if (stepIdx.value < 0 || stepIdx.value >= plan.value.length) return
  isExec.value = true
  applyStep(plan.value[stepIdx.value])
  setTimeout(() => { isExec.value = false }, 50)
}

function executeAll() {
  if (execTimer.value) return
  function runNext() {
    if (stepIdx.value >= plan.value.length) return
    isExec.value = true
    applyStep(plan.value[stepIdx.value])
    setTimeout(() => { isExec.value = false }, 50)
    if (stepIdx.value < plan.value.length) {
      execTimer.value = setTimeout(runNext, 160)
    }
  }
  runNext()
}

const planDone   = computed(() => plan.value.length > 0 && stepIdx.value >= plan.value.length)
const planActive = computed(() => plan.value.length > 0 && !planDone.value)
const stepsLeft  = computed(() => plan.value.length - stepIdx.value)

function stepClass(i: number) {
  if (plan.value[i].done)  return 'ps-step--done'
  if (i === stepIdx.value) return 'ps-step--current'
  return 'ps-step--pending'
}

// Flash helper
function flash(t: StepType) { return flashBtn.value === t }

// Manual page-change helpers (clears plan)
function manualNav(fn: () => void) { if (!isExec.value) clearPlan(); fn() }

function loadMore() {
  if (hasMore.value) manualNav(() => loadedPgs.value++)
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 40 && hasMore.value) loadedPgs.value++
}
</script>

<template>
  <div class="ps">
    <div class="ps-layout">

      <!-- ── Left: config + plan ── -->
      <div class="ps-left">

        <!-- Type selector -->
        <div class="ps-type-row">
          <label class="ps-radio" :class="{ 'ps-radio--on': ptype === 'page-buttons' }">
            <input type="radio" v-model="ptype" value="page-buttons" @change="switchType('page-buttons')" />
            Page Buttons
          </label>
          <label class="ps-radio" :class="{ 'ps-radio--on': ptype === 'load-more' }">
            <input type="radio" v-model="ptype" value="load-more" @change="switchType('load-more')" />
            Load More
          </label>
          <label class="ps-radio" :class="{ 'ps-radio--on': ptype === 'infinite-scroll' }">
            <input type="radio" v-model="ptype" value="infinite-scroll" @change="switchType('infinite-scroll')" />
            Infinite Scroll
          </label>
        </div>

        <!-- Config code editor -->
        <div class="ps-editor">

          <!-- Infinite scroll -->
          <template v-if="ptype === 'infinite-scroll'">
            <div class="ps-el"><span class="t-obj">Strategies</span><span class="t-dim">.</span><span class="t-obj">Pagination</span><span class="t-dim">.</span><span class="t-fn">infiniteScroll</span><span class="t-br">(</span><span class="t-br">{</span></div>
            <div class="ps-el ps-el--req"><span class="ps-gutter"/><span class="t-ind">  </span><span class="t-key">scrollTarget</span><span class="t-dim">: </span><span class="t-str">table.locator('.scroll-body')</span><span class="t-dim">,</span></div>
            <div class="ps-el ps-el--req"><span class="ps-gutter"/><span class="t-ind">  </span><span class="t-key">scrollAmount</span><span class="t-dim">: </span><span class="t-num">400</span><span class="t-dim">,</span></div>
            <div class="ps-el"><span class="t-br">}</span><span class="t-br">)</span></div>
          </template>

          <!-- Load more -->
          <template v-else-if="ptype === 'load-more'">
            <div class="ps-el"><span class="t-obj">Strategies</span><span class="t-dim">.</span><span class="t-obj">Pagination</span><span class="t-dim">.</span><span class="t-fn">click</span><span class="t-br">(</span><span class="t-br">{</span></div>
            <div class="ps-el ps-el--req"><span class="ps-gutter"/><span class="t-ind">  </span><span class="t-key">next</span><span class="t-dim">:  </span><span class="t-str">page.locator('[data-pg="load-more"]')</span><span class="t-dim">,</span></div>
            <div class="ps-el"><span class="t-br">}</span><span class="t-br">)</span></div>
          </template>

          <!-- Page buttons -->
          <template v-else>
            <div class="ps-el"><span class="t-obj">Strategies</span><span class="t-dim">.</span><span class="t-obj">Pagination</span><span class="t-dim">.</span><span class="t-fn">click</span><span class="t-br">(</span><span class="t-br">{</span></div>
            <!-- Required -->
            <div class="ps-el ps-el--req">
              <span class="ps-gutter ps-gutter--lock" title="required">⌁</span>
              <span class="t-ind">  </span><span class="t-key">next</span><span class="t-dim">:          </span><span class="t-str">page.locator('[data-pg="next"]')</span><span class="t-dim">,</span>
            </div>
            <div class="ps-el ps-el--req">
              <span class="ps-gutter ps-gutter--lock" title="required">⌁</span>
              <span class="t-ind">  </span><span class="t-key">previous</span><span class="t-dim">:      </span><span class="t-str">page.locator('[data-pg="prev"]')</span><span class="t-dim">,</span>
            </div>
            <!-- Optional: pageNumbers -->
            <div class="ps-el" :class="{ 'ps-el--off': !togPageNums }">
              <label class="ps-gutter ps-gutter--cb" title="toggle page number buttons">
                <input type="checkbox" v-model="togPageNums" @change="onToggle" />
              </label>
              <span class="t-ind">  </span>
              <span v-if="!togPageNums" class="t-comment">// </span>
              <span class="t-key">pageNumbers</span><span class="t-dim">:  </span><span class="t-str">page.locator('[data-pg-num]')</span><span class="t-dim">,</span>
            </div>
            <!-- Optional: first -->
            <div class="ps-el" :class="{ 'ps-el--off': !togFirst }">
              <label class="ps-gutter ps-gutter--cb" title="toggle first selector">
                <input type="checkbox" v-model="togFirst" @change="onToggle" />
              </label>
              <span class="t-ind">  </span>
              <span v-if="!togFirst" class="t-comment">// </span>
              <span class="t-key">first</span><span class="t-dim">:         </span><span class="t-str">page.locator('[data-pg="first"]')</span><span class="t-dim">,</span>
            </div>
            <!-- Optional: nextBulk -->
            <div class="ps-el" :class="{ 'ps-el--off': !togNextBulk }">
              <label class="ps-gutter ps-gutter--cb" title="toggle nextBulk selector">
                <input type="checkbox" v-model="togNextBulk" @change="onToggle" />
              </label>
              <span class="t-ind">  </span>
              <span v-if="!togNextBulk" class="t-comment">// </span>
              <span class="t-key">nextBulk</span><span class="t-dim">:      </span><span class="t-str">page.locator('[data-pg="next-bulk"]')</span><span class="t-dim">,</span>
            </div>
            <transition name="ps-fade">
              <div v-if="togNextBulk" class="ps-el ps-el--extra">
                <span class="ps-gutter"/><span class="t-ind">  </span>
                <span class="t-key">nextBulkPages</span><span class="t-dim">: </span><span class="t-num">{{ BULK_N }}</span><span class="t-dim">,</span>
              </div>
            </transition>
            <!-- Optional: previousBulk -->
            <div class="ps-el" :class="{ 'ps-el--off': !togPrevBulk }">
              <label class="ps-gutter ps-gutter--cb" title="toggle previousBulk selector">
                <input type="checkbox" v-model="togPrevBulk" @change="onToggle" />
              </label>
              <span class="t-ind">  </span>
              <span v-if="!togPrevBulk" class="t-comment">// </span>
              <span class="t-key">previousBulk</span><span class="t-dim">:  </span><span class="t-str">page.locator('[data-pg="prev-bulk"]')</span><span class="t-dim">,</span>
            </div>
            <transition name="ps-fade">
              <div v-if="togPrevBulk" class="ps-el ps-el--extra">
                <span class="ps-gutter"/><span class="t-ind">  </span>
                <span class="t-key">previousBulkPages</span><span class="t-dim">: </span><span class="t-num">{{ BULK_N }}</span><span class="t-dim">,</span>
              </div>
            </transition>
            <div class="ps-el"><span class="t-br">}</span><span class="t-br">)</span></div>
          </template>
        </div>

        <!-- Plan section -->
        <div class="ps-plan">
          <div class="ps-plan-head">{{ planHeadLabel }}</div>
          <div class="ps-plan-input-row">
            <div class="ps-from">
              <span class="ps-from-label">now</span>
              <span class="ps-from-num">{{ libPage }}</span>
            </div>
            <span class="ps-plan-arrow">→</span>
            <input
              v-model.number="targetPg" type="number" min="1" :max="TOTAL_PAGES"
              class="ps-pg-input" @keydown.enter="computePlan()" @input="clearPlan()"
            />
            <span class="ps-plan-of">/ {{ TOTAL_PAGES }}</span>
            <button class="ps-plan-btn" @click="computePlan()">Plan</button>
          </div>

          <p v-if="planInfo"  class="ps-plan-info">{{ planInfo }}</p>
          <p v-if="planError" class="ps-plan-error">{{ planError }}</p>

          <div v-if="plan.length > 0" class="ps-steps">
            <div
              v-for="(step, i) in plan" :key="i"
              class="ps-step" :class="stepClass(i)"
            >
              <span class="ps-step-n">{{ i + 1 }}</span>
              <span class="ps-step-chip" :style="{ '--c': STEP_META[step.type].color }">{{
                step.type === 'goPage' ? `#${step.targetPage}`
                : ptype === 'load-more' && step.type === 'goNext' ? '↓ Load'
                : ptype === 'infinite-scroll' && step.type === 'goNext' ? '↓ Scroll'
                : STEP_META[step.type].btn
              }}</span>
              <span class="ps-step-lbl">{{
                step.type === 'goPage' ? `Click page ${step.targetPage}`
                : ptype === 'load-more' && step.type === 'goNext' ? 'Press Load More'
                : ptype === 'infinite-scroll' && step.type === 'goNext' ? 'Scroll to load'
                : STEP_META[step.type].label
              }}</span>
              <span class="ps-step-pg">pg {{ step.targetPage }}</span>
              <span class="ps-step-icon">{{ step.done ? '✓' : (i === stepIdx ? '▶' : '') }}</span>
            </div>
          </div>

          <div v-if="planDone" class="ps-done">✓ Reached page {{ targetPg }}</div>

          <div v-if="planActive" class="ps-exec-row">
            <button class="ps-exec" @click="executeStep">Step {{ stepIdx + 1 }} / {{ plan.length }}</button>
            <button class="ps-exec ps-exec--all" @click="executeAll">Run all ({{ stepsLeft }} left)</button>
          </div>
        </div>
      </div>

      <!-- ── Right: live table + pager ── -->
      <div class="ps-right">

        <div class="ps-page-badge">
          Page <strong>{{ libPage }}</strong> <span>/ {{ TOTAL_PAGES }}</span>
        </div>

        <!-- Table -->
        <div class="ps-table-shell"
          :class="{ 'ps-table-shell--scroll': ptype === 'infinite-scroll' }"
          @scroll="ptype === 'infinite-scroll' ? onScroll($event) : undefined"
        >
          <table class="ps-table">
            <thead><tr><th>Name</th><th>Role</th><th>Office</th></tr></thead>
            <tbody>
              <tr v-for="row in tableRows" :key="row.name">
                <td>{{ row.name }}</td><td>{{ row.role }}</td><td>{{ row.office }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="ptype === 'infinite-scroll'" class="ps-scroll-hint">
            {{ hasMore ? '↓ scroll to load more' : '— end of results —' }}
          </div>
        </div>

        <!-- Pager: page-buttons -->
        <div v-if="ptype === 'page-buttons'" class="ps-pager">
          <button class="ps-pb" :class="{ 'ps-pb--dim': page===1, 'ps-pb--flash': flash('goFirst') }"
            v-if="togFirst" @click="manualNav(() => page=1)">|&lt;</button>
          <button class="ps-pb" :class="{ 'ps-pb--dim': !canPrev, 'ps-pb--flash': flash('goPrevBulk') }"
            v-if="togPrevBulk" @click="manualNav(() => page=Math.max(1,page-BULK_N))">&lt;&lt;</button>
          <button class="ps-pb" :class="{ 'ps-pb--dim': !canPrev, 'ps-pb--flash': flash('goPrev') }"
            @click="manualNav(() => page > 1 && page--)">&lt;</button>
          <template v-if="togPageNums">
            <button
              v-for="n in pageWindow" :key="n"
              class="ps-pb ps-pb--num"
              :class="{ 'ps-pb--current': n === page, 'ps-pb--flash': flash('goPage') && flashTargetPage === n }"
              @click="manualNav(() => page = n)"
            >{{ n }}</button>
          </template>
          <span v-else class="ps-pager-info">{{ page }} of {{ TOTAL_PAGES }}</span>
          <button class="ps-pb" :class="{ 'ps-pb--dim': !canNext, 'ps-pb--flash': flash('goNext') }"
            @click="manualNav(() => page < TOTAL_PAGES && page++)">&gt;</button>
          <button class="ps-pb" :class="{ 'ps-pb--dim': !canNext, 'ps-pb--flash': flash('goNextBulk') }"
            v-if="togNextBulk" @click="manualNav(() => page=Math.min(TOTAL_PAGES,page+BULK_N))">&gt;&gt;</button>
          <button class="ps-pb" :class="{ 'ps-pb--dim': page===TOTAL_PAGES }"
            @click="manualNav(() => page=TOTAL_PAGES)">&gt;|</button>
        </div>

        <!-- Pager: load-more -->
        <div v-else-if="ptype === 'load-more'" class="ps-pager">
          <button class="ps-pb ps-pb--load-more"
            :class="{ 'ps-pb--dim': !hasMore, 'ps-pb--flash': flash('goNext') }"
            @click="loadMore()">
            {{ hasMore ? 'Load More' : 'All loaded' }}
          </button>
          <span class="ps-pager-info">{{ loadedPgs * PAGE_SIZE }} of {{ TOTAL_PAGES * PAGE_SIZE }} rows</span>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.ps {
  margin: 16px 0;
  border: 1px solid color-mix(in srgb, var(--vp-c-divider) 85%, transparent);
  border-radius: 12px; overflow: hidden;
  background: var(--vp-c-bg);
}
.ps-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
}
@media (max-width: 760px) { .ps-layout { grid-template-columns: 1fr; } }

/* ── Left ── */
.ps-left {
  display: flex; flex-direction: column; gap: 14px;
  padding: 16px;
  border-right: 1px solid color-mix(in srgb, var(--vp-c-divider) 70%, transparent);
}

/* Type radios — segmented control */
.ps-type-row {
  display: inline-flex;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  align-self: flex-start;
}
.ps-radio {
  display: flex; align-items: center;
  padding: 5px 14px; cursor: pointer;
  font-size: 0.75rem; font-weight: 500;
  border: none;
  border-right: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  transition: color 0.15s, background 0.15s;
  user-select: none;
  white-space: nowrap;
}
.ps-radio:last-child { border-right: none; }
.ps-radio input { display: none; }
.ps-radio--on {
  background: color-mix(in srgb, var(--vp-c-brand-1) 16%, var(--vp-c-bg-soft));
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
.ps-radio:hover:not(.ps-radio--on) {
  background: color-mix(in srgb, var(--vp-c-divider) 40%, var(--vp-c-bg-soft));
  color: var(--vp-c-text-1);
}

/* Config editor */
.ps-editor {
  background: #1e1e1e; border: 1px solid #2d2d2d; border-radius: 10px;
  padding: 10px 0; font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem; line-height: 1.9;
}
.ps-el {
  display: flex; align-items: center; padding: 0 12px 0 0;
  transition: opacity 0.2s;
}
.ps-el--req  { }
.ps-el--off  { opacity: 0.4; }
.ps-el--extra { padding-left: 0; }

/* Gutter */
.ps-gutter {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; flex-shrink: 0;
}
.ps-gutter--lock {
  color: #4a4a5a; font-size: 0.65rem; cursor: default;
}
.ps-gutter--cb { cursor: pointer; }
.ps-gutter--cb input { accent-color: #818cf8; cursor: pointer; width: 12px; height: 12px; }

/* Token colours */
.t-obj     { color: #9cdcfe; }
.t-fn      { color: #dcdcaa; }
.t-key     { color: #9cdcfe; }
.t-str     { color: #ce9178; }
.t-num     { color: #b5cea8; }
.t-br      { color: #da70d6; }
.t-dim     { color: #858585; }
.t-ind     { white-space: pre; color: #858585; user-select: none; }
.t-comment { color: #5a5a72; }

/* ── Plan ── */
.ps-plan { display: flex; flex-direction: column; gap: 8px; }
.ps-plan-head {
  font-size: 0.67rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--vp-c-text-2);
}
.ps-plan-input-row {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
}
.ps-from {
  display: flex; align-items: baseline; gap: 4px;
  padding: 4px 10px; border-radius: 7px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 10%, var(--vp-c-bg));
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 30%, transparent);
}
.ps-from-label { font-size: 0.63rem; font-weight: 700; text-transform: uppercase; color: var(--vp-c-text-2); }
.ps-from-num   { font-size: 1.1rem; font-weight: 800; color: var(--vp-c-brand-1); line-height: 1; font-variant-numeric: tabular-nums; }
.ps-plan-arrow { color: var(--vp-c-text-3); }
.ps-pg-input {
  width: 52px; text-align: center; padding: 5px 6px;
  border: 1px solid var(--vp-c-divider); border-radius: 6px;
  background: var(--vp-c-bg); color: var(--vp-c-text-1);
  font-size: 0.9rem; font-weight: 700; outline: none;
}
.ps-pg-input:focus { border-color: var(--vp-c-brand-1); }
.ps-plan-of { font-size: 0.72rem; color: var(--vp-c-text-3); }
.ps-plan-btn {
  padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;
  border: 1px solid var(--vp-c-brand-1); color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 8%, var(--vp-c-bg));
  cursor: pointer; transition: background 0.15s;
}
.ps-plan-btn:hover { background: color-mix(in srgb, var(--vp-c-brand-1) 16%, var(--vp-c-bg)); }
.ps-plan-info {
  margin: 0; font-size: 0.72rem;
  padding: 5px 8px; border-radius: 6px;
  color: var(--vp-c-text-2);
  background: color-mix(in srgb, var(--vp-c-bg-soft) 60%, var(--vp-c-bg));
  border: 1px solid color-mix(in srgb, var(--vp-c-divider) 70%, transparent);
}
.ps-plan-error {
  margin: 0; font-size: 0.72rem; color: #f87171;
  padding: 5px 8px; border-radius: 6px;
  background: color-mix(in srgb, #dc2626 8%, var(--vp-c-bg));
  border: 1px solid color-mix(in srgb, #f87171 35%, transparent);
}

/* Steps */
.ps-steps {
  display: flex; flex-direction: column; gap: 3px;
  max-height: 200px; overflow-y: auto;
}
.ps-step {
  display: grid; grid-template-columns: 22px auto 1fr auto 18px;
  align-items: center; gap: 6px;
  padding: 4px 8px; border-radius: 7px; font-size: 0.73rem;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}
.ps-step--pending { opacity: 0.38; }
.ps-step--current {
  background: color-mix(in srgb, var(--vp-c-brand-1) 8%, var(--vp-c-bg));
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 35%, transparent);
  opacity: 1;
}
.ps-step--done { opacity: 0.45; }
.ps-step-n    { font-size: 0.62rem; color: var(--vp-c-text-3); font-weight: 600; text-align: right; }
.ps-step-chip {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.68rem; font-weight: 700;
  color: var(--c, var(--vp-c-brand-1));
  background: color-mix(in srgb, var(--c, var(--vp-c-brand-1)) 12%, var(--vp-c-bg));
  border: 1px solid color-mix(in srgb, var(--c, var(--vp-c-brand-1)) 30%, transparent);
  padding: 1px 5px; border-radius: 4px; white-space: nowrap;
}
.ps-step-lbl  { color: var(--vp-c-text-2); font-size: 0.7rem; }
.ps-step-pg   { font-size: 0.65rem; color: var(--vp-c-text-3); text-align: right; white-space: nowrap; }
.ps-step-icon { font-size: 0.7rem; color: var(--vp-c-brand-1); text-align: center; }
.ps-step--done .ps-step-icon { color: #22c55e; }

.ps-done {
  padding: 7px 10px; border-radius: 7px; font-size: 0.76rem; font-weight: 600;
  color: #22c55e; text-align: center;
  background: color-mix(in srgb, #16a34a 10%, var(--vp-c-bg));
  border: 1px solid color-mix(in srgb, #22c55e 40%, transparent);
}
.ps-exec-row { display: flex; gap: 7px; }
.ps-exec {
  flex: 1; padding: 7px; border-radius: 8px; font-size: 0.75rem; font-weight: 600;
  border: 1px solid var(--vp-c-brand-1); color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 10%, var(--vp-c-bg));
  cursor: pointer; transition: background 0.15s;
}
.ps-exec:hover { background: color-mix(in srgb, var(--vp-c-brand-1) 20%, var(--vp-c-bg)); }
.ps-exec--all {
  border-color: #818cf8; color: #818cf8;
  background: color-mix(in srgb, #818cf8 10%, var(--vp-c-bg));
}
.ps-exec--all:hover { background: color-mix(in srgb, #818cf8 20%, var(--vp-c-bg)); }

/* ── Right ── */
.ps-right {
  display: flex; flex-direction: column; gap: 10px;
  padding: 16px; background: var(--vp-c-bg-soft);
}
.ps-page-badge {
  font-size: 0.8rem; color: var(--vp-c-text-2);
  display: flex; align-items: baseline; gap: 4px;
}
.ps-page-badge strong { font-size: 1.1rem; color: var(--vp-c-text-1); font-variant-numeric: tabular-nums; }

.ps-table-shell {
  border: 1px solid color-mix(in srgb, var(--vp-c-divider) 70%, transparent);
  border-radius: 8px; overflow: hidden; background: var(--vp-c-bg);
  width: 100%;
  display: flex; justify-content: center;
}
.ps-table-shell--scroll { max-height: 220px; overflow-y: auto; }
.ps-table { width: auto; min-width: 280px; border-collapse: collapse; font-size: 0.76rem; }
.ps-table th, .ps-table td {
  padding: 6px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--vp-c-divider) 60%, transparent);
  text-align: left;
}
.ps-table th {
  font-size: 0.67rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--vp-c-text-2);
  background: color-mix(in srgb, var(--vp-c-bg-soft) 70%, var(--vp-c-bg));
}
.ps-scroll-hint { text-align: center; padding: 8px; font-size: 0.7rem; color: var(--vp-c-text-3); }

/* Pager */
.ps-pager { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.ps-pager-info { font-size: 0.73rem; color: var(--vp-c-text-2); padding: 0 5px; }
.ps-pb {
  font-size: 0.72rem; font-weight: 600; padding: 4px 9px;
  border-radius: 6px; border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg); color: var(--vp-c-text-1);
  cursor: pointer; font-family: monospace;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.ps-pb:hover:not(.ps-pb--dim) { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.ps-pb--dim      { opacity: 0.3; cursor: default; }
.ps-pb--load-more { font-family: inherit; padding: 6px 16px; }
.ps-pb--num      { min-width: 28px; padding: 4px 5px; text-align: center; }
.ps-pb--current  {
  background: color-mix(in srgb, var(--vp-c-brand-1) 18%, var(--vp-c-bg));
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 700;
  cursor: default;
}
@keyframes flash {
  0%   { background: color-mix(in srgb, var(--vp-c-brand-1) 40%, var(--vp-c-bg)); border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
  100% { background: var(--vp-c-bg); }
}
.ps-pb--flash { animation: flash 0.32s ease-out; }

/* Transition */
.ps-fade-enter-active, .ps-fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.ps-fade-enter-from, .ps-fade-leave-to { opacity: 0; transform: translateY(-3px); }
</style>
