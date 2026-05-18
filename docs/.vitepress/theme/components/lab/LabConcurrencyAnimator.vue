<script setup lang="ts">
import { ref, reactive, computed, onUnmounted, onMounted, watchEffect } from 'vue'

// Pointer cursor: arrow + ripple ring. Both are :global-styled (dynamic elements lack Vue scope attr).
const CURSOR_SVG = [
  '<svg class="ca-cursor-svg" width="17" height="22" viewBox="0 0 17 22" fill="none">',
    '<path d="M2.5 1.5 L2.5 17 L6 13.5 L9.5 21 L12 20 L8.5 12.5 L14.5 12.5 Z"',
          'fill="white" stroke="#0f172a" stroke-width="1.6"',
          'stroke-linejoin="round" stroke-linecap="round"/>',
  '</svg>',
  '<div class="ca-cursor-ripple"></div>',
].join('')

const rows = [
  { name: 'Airi Satou',    initials: 'AS', role: 'Accountant', office: 'Tokyo',  status: 'Active',   dept: 'Operations', started: '2019-03' },
  { name: 'Bradley Greer', initials: 'BG', role: 'Engineer',   office: 'London', status: 'Active',   dept: 'Engineering',started: '2021-07' },
  { name: 'Cedric Kelly',  initials: 'CK', role: 'Manager',    office: 'Berlin', status: 'Active',   dept: 'Sales',      started: '2018-11' },
  { name: 'Dana Wade',     initials: 'DW', role: 'Engineer',   office: 'Tokyo',  status: 'Active',   dept: 'Engineering',started: '2022-01' },
  { name: 'Eric Monk',     initials: 'EM', role: 'Manager',    office: 'London', status: 'Inactive', dept: 'Product',    started: '2020-05' },
  { name: 'Fiona Yang',    initials: 'FY', role: 'Accountant', office: 'Sydney', status: 'Active',   dept: 'Operations', started: '2023-09' },
  { name: 'George Fox',    initials: 'GF', role: 'Engineer',   office: 'Berlin', status: 'Active',   dept: 'Engineering',started: '2021-03' },
  { name: 'Helen Vance',   initials: 'HV', role: 'Manager',    office: 'Sydney', status: 'Active',   dept: 'Product',    started: '2019-08' },
  { name: 'Ivan Cross',    initials: 'IC', role: 'Accountant', office: 'Tokyo',  status: 'Active',   dept: 'Operations', started: '2022-11' },
]

type Scenario = 'all-dom' | 'col-virtual' | 'tooltip'
type Mode     = 'sequential' | 'parallel' | 'synchronized'
type RowPhase = 'idle' | 'visiting' | 'col-scroll' | 'hover' | 'reading' | 'done' | 'wrong' | 'conflict'
type Speed    = 'realistic' | 'normal' | 'slow' | 'very-slow'

const MODES:     Mode[]     = ['sequential', 'parallel', 'synchronized']
const SCENARIOS: Scenario[] = ['all-dom', 'col-virtual', 'tooltip']
const SPEEDS:    Speed[]    = ['realistic', 'normal', 'slow', 'very-slow']

const scenario = ref<Scenario>('all-dom')
const speed    = ref<Speed>('normal')

const SCENARIO_LABELS: Record<Scenario, string> = {
  'all-dom':     '1 · All cells in DOM',
  'col-virtual': '2 · Columns virtualized',
  'tooltip':     '3 · Click for name',
}
const MODE_LABELS: Record<Mode, string> = {
  sequential: 'Sequential', parallel: 'Parallel', synchronized: 'Synchronized',
}
const MODE_CODE: Record<Mode, string> = {
  sequential:   "forEach(fn)",
  parallel:     "forEach(fn, { concurrency: 'parallel' })",
  synchronized: "forEach(fn, { concurrency: 'synchronized' })",
}
const SPEED_LABELS: Record<Speed, string> = {
  realistic: 'Realistic', normal: 'Normal', slow: '2× slower', 'very-slow': '4× slower',
}

const BROKEN: Record<Scenario, Mode[]> = {
  'all-dom':     [],
  'col-virtual': ['parallel'],
  'tooltip':     ['parallel', 'synchronized'],
}
const DIM: Record<Scenario, Mode[]> = {
  'all-dom':     ['synchronized'],
  'col-virtual': [],
  'tooltip':     [],
}
const RECOMMENDED: Record<Scenario, Mode> = {
  'all-dom': 'parallel', 'col-virtual': 'synchronized', 'tooltip': 'sequential',
}
const DIM_NOTE: Record<Scenario, Partial<Record<Mode, string>>> = {
  'all-dom': { synchronized: 'No scroll needed — barrier never fires. Same result as parallel. Prefer parallel.' },
  'col-virtual': {}, 'tooltip': {},
}
const BROKEN_WHY: Record<Scenario, Partial<Record<Mode, string>>> = {
  'all-dom': {},
  'col-virtual': {
    parallel: 'No barrier — each row calls scrollToColumn independently. Rows race to the same column and land out of sync.',
  },
  'tooltip': {
    parallel:     'All rows click simultaneously — only one cell can be active at a time. Each click collapses the previous, so most reads get nothing.',
    synchronized: 'The barrier coordinates column scrolls, not row callbacks. Rows still click concurrently — same conflict.',
  },
}

type SpeedParams = {
  visit: number; gap: number
  scrollDur: number; pageGap: number
  hoverDur: number; readDur: number
}
const SPEED_PARAMS: Record<Speed, SpeedParams> = {
  realistic:   { visit: 18,  gap: 8,   scrollDur: 25,  pageGap: 12,  hoverDur: 30,  readDur: 20  },
  normal:      { visit: 180, gap: 70,  scrollDur: 160, pageGap: 90,  hoverDur: 220, readDur: 150 },
  slow:        { visit: 360, gap: 140, scrollDur: 320, pageGap: 180, hoverDur: 440, readDur: 300 },
  'very-slow': { visit: 720, gap: 280, scrollDur: 640, pageGap: 360, hoverDur: 880, readDur: 600 },
}

type Col = { key: string; label: string; virtual?: boolean }
const COLS: Record<Scenario, Col[]> = {
  'all-dom':     [{ key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'status', label: 'Status' }],
  'col-virtual': [
    { key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'office', label: 'Office' },
    { key: 'status', label: 'Status', virtual: true }, { key: 'dept', label: 'Dept', virtual: true },
    { key: 'started', label: 'Started', virtual: true },
  ],
  'tooltip': [{ key: 'user', label: 'User' }, { key: 'role', label: 'Role' }, { key: 'status', label: 'Status' }],
}

function cellVal(row: typeof rows[0], key: string): string {
  if (key === 'user') return row.initials
  return (row as any)[key] ?? ''
}

// State
const mkPhases = () => ({ sequential: Array(9).fill('idle') as RowPhase[], parallel: Array(9).fill('idle') as RowPhase[], synchronized: Array(9).fill('idle') as RowPhase[] })
const mainPhases = ref(mkPhases())
const brkPhases  = ref(mkPhases())

// Which row index (0-8) currently has its name cell expanded; null = none
const activeMain = reactive<Record<Mode, number | null>>({ sequential: null, parallel: null, synchronized: null })
const activeBrk  = reactive<Record<Mode, number | null>>({ sequential: null, parallel: null, synchronized: null })
// Cursor position (where it's pointing) is decoupled from cell open state so the
// cursor can travel to a row BEFORE the click fires and the cell opens.
const cursorPos  = reactive<Record<Mode, number | null>>({ sequential: null, parallel: null, synchronized: null })
// Increments each time a click should play — watchEffect keys off this for the animation.
const clickCount = reactive<Record<Mode, number>>({ sequential: 0, parallel: 0, synchronized: 0 })

// Broken-scenario shake: incrementing triggers a shake animation on page 1's table shell.
const brkShakeCount = reactive<Record<Mode, number>>({ sequential: 0, parallel: 0, synchronized: 0 })
// Broken-scenario cursor linger: true keeps all 3 brk cursors visible after phases settle.
// Set true at settle time, false 2s later so cursors fade out smoothly.
const brkCursorLinger = reactive<Record<Mode, boolean>>({ sequential: false, parallel: false, synchronized: false })

const brkRevealed = ref<Record<Mode, boolean>>({ sequential: false, parallel: false, synchronized: false })
const brkRunning  = ref<Record<Mode, boolean>>({ sequential: false, parallel: false, synchronized: false })
const elapsed     = reactive<Record<Mode, number | null>>({ sequential: null, parallel: null, synchronized: null })
const isRunning   = ref(false)
const hasRun      = ref(false)
const startTime   = ref(0)

const timers: ReturnType<typeof setTimeout>[] = []
const brkTimers: Partial<Record<Mode, ReturnType<typeof setTimeout>[]>> = {}
function after(ms: number, fn: () => void) { timers.push(setTimeout(fn, ms)) }
function afterB(m: Mode, ms: number, fn: () => void) {
  if (!brkTimers[m]) brkTimers[m] = []
  brkTimers[m]!.push(setTimeout(fn, ms))
}
onUnmounted(() => {
  timers.forEach(clearTimeout)
  Object.values(brkTimers).forEach(a => a?.forEach(clearTimeout))
})

function setM(m: Mode, idx: number | 'all', ph: RowPhase) {
  const a = [...mainPhases.value[m]]
  if (idx === 'all') a.fill(ph); else a[idx] = ph
  mainPhases.value[m] = a
}
function setPg(m: Mode, pg: number, ph: RowPhase) {
  const a = [...mainPhases.value[m]]
  for (let i = pg * 3; i < pg * 3 + 3; i++) a[i] = ph
  mainPhases.value[m] = a
}
function setB(m: Mode, idx: number | 'all', ph: RowPhase) {
  const a = [...brkPhases.value[m]]
  if (idx === 'all') a.fill(ph); else a[idx] = ph
  brkPhases.value[m] = a
}

function hardReset() {
  timers.forEach(clearTimeout); timers.length = 0
  Object.values(brkTimers).forEach(a => a?.forEach(clearTimeout))
  mainPhases.value = mkPhases()
  brkPhases.value  = mkPhases()
  MODES.forEach(m => {
    activeMain[m] = null; activeBrk[m] = null; cursorPos[m] = null; clickCount[m] = 0
    brkShakeCount[m] = 0; brkCursorLinger[m] = false
  })
  brkRevealed.value = { sequential: false, parallel: false, synchronized: false }
  brkRunning.value  = { sequential: false, parallel: false, synchronized: false }
  elapsed.sequential = null; elapsed.parallel = null; elapsed.synchronized = null
}

function runAll() {
  hardReset()
  isRunning.value = true
  hasRun.value    = true
  startTime.value = performance.now()
  const p = SPEED_PARAMS[speed.value]
  if (scenario.value === 'all-dom') {
    runAllDom(p)
  } else if (scenario.value === 'col-virtual') {
    runColVirtual(p)
    revealBroken('parallel')
  } else {
    runTooltipMain(p)
    BROKEN['tooltip'].forEach(m => revealBroken(m))
  }
}

function runAllDom(p: SpeedParams) {
  for (let i = 0; i < 9; i++) {
    after(i * (p.visit + p.gap), () => setM('sequential', i, 'visiting'))
    after(i * (p.visit + p.gap) + p.visit, () => setM('sequential', i, 'done'))
  }
  const seqEnd = 9 * (p.visit + p.gap)
  after(seqEnd, () => { elapsed.sequential = Math.round(performance.now() - startTime.value) })

  // Parallel / synchronized: rows within each page run concurrently, pages are still sequential
  const pgDur = p.visit + p.pageGap
  for (let pg = 0; pg < 3; pg++) {
    after(pg * pgDur,          () => setPg('parallel',     pg, 'visiting'))
    after(pg * pgDur + p.visit, () => setPg('parallel',     pg, 'done'))
    after(pg * pgDur,          () => setPg('synchronized', pg, 'visiting'))
    after(pg * pgDur + p.visit, () => setPg('synchronized', pg, 'done'))
  }
  const parEnd = 2 * pgDur + p.visit
  after(parEnd, () => {
    elapsed.parallel     = Math.round(performance.now() - startTime.value)
    elapsed.synchronized = Math.round(performance.now() - startTime.value)
  })

  after(Math.max(seqEnd, parEnd) + 100, () => { isRunning.value = false })
}

function runColVirtual(p: SpeedParams) {
  const rowT = p.visit + p.scrollDur + p.gap
  for (let i = 0; i < 9; i++) {
    after(i * rowT,                         () => setM('sequential', i, 'visiting'))
    after(i * rowT + p.visit,               () => setM('sequential', i, 'col-scroll'))
    after(i * rowT + p.visit + p.scrollDur, () => setM('sequential', i, 'done'))
  }
  const seqEnd = 9 * rowT
  after(seqEnd, () => { elapsed.sequential = Math.round(performance.now() - startTime.value) })

  const pgT = p.visit + p.scrollDur + p.pageGap
  for (let pg = 0; pg < 3; pg++) {
    after(pg * pgT,                         () => setPg('synchronized', pg, 'visiting'))
    after(pg * pgT + p.visit,               () => setPg('synchronized', pg, 'col-scroll'))
    after(pg * pgT + p.visit + p.scrollDur, () => setPg('synchronized', pg, 'done'))
  }
  const synEnd = 3 * pgT
  after(synEnd, () => { elapsed.synchronized = Math.round(performance.now() - startTime.value) })

  after(Math.max(seqEnd, synEnd) + 100, () => { isRunning.value = false })
}

function runTooltipMain(p: SpeedParams) {
  const rowT    = p.hoverDur + p.readDur + p.gap
  // clickDelay: brief pause between click-animation firing and the cell actually opening.
  // Keeps it snappy but visually causal.
  const clickDelay = Math.max(30, Math.round(p.gap * 0.15))

  for (let i = 0; i < 9; i++) {
    const base = i * rowT

    // Step 1 — cursor travels to row i.
    // Starts at the beginning of the gap period (end of previous row), so the cursor is
    // mid-travel while the previous row's name is still visible.
    after(Math.max(0, base - p.gap), () => { cursorPos.sequential = i })

    // Step 2 — cursor arrives and clicks.
    after(base, () => { clickCount.sequential++ })

    // Step 3 — cell opens (closes previous cell simultaneously via activeMain swap).
    after(base + clickDelay, () => {
      setM('sequential', i, 'hover')
      activeMain.sequential = i
    })
    after(base + clickDelay + p.hoverDur, () => setM('sequential', i, 'reading'))
    after(base + clickDelay + p.hoverDur + p.readDur, () => {
      setM('sequential', i, 'done')
      // name stays open — the NEXT row's click will close it
    })
  }

  // After the last row: cursor moves away, last cell closes
  const lastBase  = 8 * rowT
  const lastClose = lastBase + clickDelay + p.hoverDur + p.readDur + Math.round(p.gap * 0.5)
  after(lastClose, () => { cursorPos.sequential = null; activeMain.sequential = null })

  const seqEnd = 9 * rowT
  after(seqEnd, () => { elapsed.sequential = Math.round(performance.now() - startTime.value) })
  after(seqEnd + 100, () => { isRunning.value = false })
}

function revealBroken(mode: Mode) {
  brkTimers[mode]?.forEach(clearTimeout)
  brkTimers[mode] = []
  brkPhases.value[mode] = Array(9).fill('idle')
  activeBrk[mode] = null
  brkRevealed.value[mode] = true
  brkRunning.value[mode]  = true
  const p = SPEED_PARAMS[speed.value]

  if (scenario.value === 'col-virtual') {
    // Only page 1 (rows 0-2) runs before the conflict — parallel fires all 3 simultaneously
    afterB(mode, 0, () => {
      setB(mode, 0, 'visiting'); setB(mode, 1, 'visiting'); setB(mode, 2, 'visiting')
    })
    afterB(mode, p.visit, () => {
      setB(mode, 0, 'col-scroll'); setB(mode, 1, 'col-scroll'); setB(mode, 2, 'col-scroll')
    })
    afterB(mode, p.visit + Math.round(p.scrollDur * 0.55), () => {
      setB(mode, 0, 'done'); setB(mode, 1, 'wrong')
    })
    afterB(mode, p.visit + p.scrollDur, () => {
      setB(mode, 2, 'conflict')
    })
    afterB(mode, p.visit + p.scrollDur + p.pageGap, () => { brkRunning.value[mode] = false })
  }

  else if (scenario.value === 'tooltip') {
    // 3 arrows land on page 1's rows simultaneously, all click at once → table shakes.
    const g = p.gap
    const h = p.hoverDur

    // All 3 page-1 workers arrive at their rows at the same time
    afterB(mode, 0, () => { setB(mode, 0, 'hover'); setB(mode, 1, 'hover'); setB(mode, 2, 'hover') })

    // All 3 click simultaneously
    afterB(mode, g, () => { clickCount[mode]++ })

    // Table shakes shortly after to signal the conflict; timings scale with speed params
    const shakeAt  = Math.round(g * 1.2)
    const settleAt = shakeAt + Math.round(h * 0.5)
    const doneAt   = settleAt + Math.round(h * 0.5)

    afterB(mode, shakeAt,  () => { brkShakeCount[mode]++ })
    // Cursors stay visible; rows settle to conflict/wrong
    afterB(mode, settleAt, () => {
      setB(mode, 0, 'conflict'); setB(mode, 1, 'wrong'); setB(mode, 2, 'wrong')
      activeBrk[mode] = null
      brkCursorLinger[mode] = true    // keep cursors on screen
    })
    // 2 s later: cursors fade out
    afterB(mode, settleAt + 2000, () => { brkCursorLinger[mode] = false })
    afterB(mode, doneAt,          () => { brkRunning.value[mode] = false })
  }
}

function setScenario(s: Scenario) {
  hardReset()
  scenario.value  = s
  isRunning.value = false
  hasRun.value    = false
}

const isBroken      = (m: Mode) => BROKEN[scenario.value].includes(m)
const isDim         = (m: Mode) => DIM[scenario.value].includes(m)
const isRecommended = (m: Mode) => RECOMMENDED[scenario.value] === m

function dispPhases(m: Mode): RowPhase[] {
  return brkRevealed.value[m] ? brkPhases.value[m] : mainPhases.value[m]
}
function pageHasPhase(phases: RowPhase[], pg: number, ph: RowPhase): boolean {
  for (let i = pg * 3; i < pg * 3 + 3; i++) if (phases[i] === ph) return true
  return false
}

const pageRows = computed(() => [rows.slice(0, 3), rows.slice(3, 6), rows.slice(6, 9)])
function curActive(m: Mode): number | null {
  return brkRevealed.value[m] ? activeBrk[m] : activeMain[m]
}

// VitePress SSR hydration leaves nested span el refs detached from the live DOM.
// watchEffect bypasses the block-tree entirely and patches the live DOM directly.
onMounted(() => {
  // flush:'post' — runs after Vue has patched the DOM, so template-owned elements
  // (badges, panel classes, elapsed, scroll chips, table shell classes) are already
  // correct and we never fight Vue's reactive updates.
  watchEffect(() => {
    const isWide    = scenario.value === 'col-virtual'
    const isTipScen = scenario.value === 'tooltip'

    MODES.forEach(m => {
      const panel = document.querySelector<HTMLElement>(`.ca-panel[data-mode="${m}"]`)
      if (!panel) return

      // Active cell (scenario 3) — manage avatar click state + name span.
      // Avatars and ca-td--user are created by Vue's template on each re-key;
      // with flush:'post' they are already in the live DOM when we get here.
      if (isTipScen) {
        // Stamp ca-td--user imperatively as a safety net for the SSR-hydrated first render
        // where Vue's :class binding can target ghost vnodes instead of live DOM.
        panel.querySelectorAll<HTMLElement>('tbody tr td:first-child').forEach(td => {
          if (!td.classList.contains('ca-td--user')) td.classList.add('ca-td--user')
        })

        const active = curActive(m)
        panel.querySelectorAll<HTMLElement>('.ca-td--user').forEach((td, rIdx) => {
          const avatarEl = td.querySelector<HTMLElement>('.ca-avatar')
          let   nameEl   = td.querySelector<HTMLElement>('.ca-cell-name')
          if (rIdx === active) {
            if (avatarEl && !avatarEl.classList.contains('ca-avatar--clicking')) {
              avatarEl.classList.add('ca-avatar--clicking')
            }
            if (!nameEl) {
              nameEl = document.createElement('span')
              nameEl.className = 'ca-cell-name'
              nameEl.style.animation = 'ca-name-pop 0.13s ease-out'
              td.appendChild(nameEl)
            }
            nameEl.textContent = rows[rIdx].name
          } else {
            if (avatarEl) {
              avatarEl.classList.remove('ca-avatar--clicking')
              avatarEl.style.opacity   = ''
              avatarEl.style.transform = ''
            }
            nameEl?.remove()
          }
        })
      } else {
        // Cursor divs are appended to the panel root (outside Vue's vnode tree) so Vue's
        // re-key won't remove them. Everything else (avatars, ca-td--user, cell text) is
        // owned by Vue's template and is cleaned up automatically on re-key.
        panel.querySelectorAll<HTMLElement>('.ca-mouse-cursor').forEach(el => el.remove())
      }

      // Mouse cursor (scenario 3)
      if (isTipScen) {
        const tds    = Array.from(panel.querySelectorAll<HTMLElement>('.ca-td--user'))
        const phases = dispPhases(m)

        if (brkRevealed.value[m]) {
          // ── Broken scenario: 3 cursors on page 1 rows, simultaneous click, table shake ──
          panel.querySelectorAll<HTMLElement>('.ca-mouse-cursor[data-brk-a], .ca-mouse-cursor[data-brk-b]').forEach(el => el.remove())
          panel.querySelector<HTMLElement>('.ca-mouse-cursor:not([data-brk-row])')?.remove()

          // tds comes from panel.querySelectorAll('.ca-td--user') — same source the main cursor
          // uses successfully. tds[0..2] are the three page-1 user cells.
          const page1Shell = tds[0]?.closest<HTMLElement>('.ca-table-shell') ?? null

          const curClickN = clickCount[m]
          ;[0, 1, 2].forEach(rowIdx => {
            const td = tds[rowIdx]
            if (!td) return
            let c = panel.querySelector<HTMLElement>(`.ca-mouse-cursor[data-brk-row="${rowIdx}"]`)
            if (!c) {
              c = document.createElement('div')
              c.className = 'ca-mouse-cursor'
              c.dataset.brkRow = String(rowIdx)
              c.innerHTML = CURSOR_SVG
              c.style.transition = 'opacity 0.5s ease'    // slow fade; no transform transition — always snap
              panel.appendChild(c)
            }
            // Recalculate position every run — the banner may have collapsed since last render,
            // shifting cell positions. No transform transition so this always snaps instantly.
            const pr = panel.getBoundingClientRect()
            const tr = td.getBoundingClientRect()
            c.style.transform = `translate(${Math.round(tr.left - pr.left + tr.width / 2 - 5)}px, ${Math.round(tr.top - pr.top + tr.height / 2 - 3)}px)`
            // Visible while hovering; also stays visible during the 2s linger after settling
            c.style.opacity = (phases[rowIdx] === 'hover' || brkCursorLinger[m]) ? '1' : '0'

            // All 3 click together when clickCount increments
            const clickKey = String(curClickN)
            if (c.dataset.lastClick !== clickKey && curClickN > 0) {
              c.dataset.lastClick = clickKey
              const svg    = c.querySelector<HTMLElement>('.ca-cursor-svg')
              const ripple = c.querySelector<HTMLElement>('.ca-cursor-ripple')
              if (svg)    { svg.style.animation    = 'none'; void svg.getBoundingClientRect();    svg.style.animation    = 'ca-cursor-click 0.22s cubic-bezier(0.36,0.07,0.19,0.97)' }
              if (ripple) { ripple.style.animation = 'none'; void ripple.getBoundingClientRect(); ripple.style.animation = 'ca-cursor-ripple 0.5s ease-out forwards' }
            }
          })

          // Shake page 1's table shell when brkShakeCount increments
          const shakeKey = String(brkShakeCount[m])
          if (page1Shell && page1Shell.dataset.lastShake !== shakeKey && brkShakeCount[m] > 0) {
            page1Shell.dataset.lastShake = shakeKey
            page1Shell.style.animation = 'none'
            void page1Shell.getBoundingClientRect()
            page1Shell.style.animation = 'ca-shake 0.45s ease'
          }

        } else {
          // ── Main animation: single travelling cursor ──
          // Remove any broken-scenario cursors (per-row from old approach, or two-cursor from new)
          panel.querySelectorAll<HTMLElement>('.ca-mouse-cursor[data-brk-row], .ca-mouse-cursor[data-brk-a], .ca-mouse-cursor[data-brk-b]').forEach(el => el.remove())

          let cursor = panel.querySelector<HTMLElement>('.ca-mouse-cursor')
          if (!cursor) {
            cursor = document.createElement('div')
            cursor.className = 'ca-mouse-cursor'
            cursor.innerHTML = CURSOR_SVG
            panel.appendChild(cursor)
            // Pre-position at first user cell so first appearance has no jump
            if (tds[0]) {
              const pr = panel.getBoundingClientRect()
              const tr = tds[0].getBoundingClientRect()
              cursor.style.transform = `translate(${Math.round(tr.left - pr.left + tr.width / 2 - 5)}px, ${Math.round(tr.top - pr.top + tr.height / 2 - 3)}px)`
            }
          }

          // Match travel duration to gap so cursor finishes before click fires
          const gapMs = SPEED_PARAMS[speed.value].gap
          cursor.style.transition = `transform ${Math.round(gapMs * 0.82)}ms cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.15s ease`

          const curPos = cursorPos[m]
          if (curPos !== null && tds[curPos]) {
            const pr = panel.getBoundingClientRect()
            const tr = tds[curPos].getBoundingClientRect()
            const x  = Math.round(tr.left - pr.left + tr.width  / 2 - 5)
            const y  = Math.round(tr.top  - pr.top  + tr.height / 2 - 3)
            const posKey = `${x},${y}`
            if (cursor.dataset.pos !== posKey) {
              cursor.dataset.pos = posKey
              cursor.style.transform = `translate(${x}px, ${y}px)`
            }
            cursor.style.opacity = '1'
          } else {
            cursor.style.opacity = '0'
            delete cursor.dataset.pos
          }

          // Click animation driven by clickCount (decoupled from cursor movement)
          const curClickN = String(clickCount[m])
          if (cursor.dataset.lastClick !== curClickN) {
            cursor.dataset.lastClick = curClickN
            if (clickCount[m] > 0) {
              const svg    = cursor.querySelector<HTMLElement>('.ca-cursor-svg')
              const ripple = cursor.querySelector<HTMLElement>('.ca-cursor-ripple')
              if (svg)    { svg.style.animation    = 'none'; void svg.getBoundingClientRect();    svg.style.animation    = 'ca-cursor-click 0.22s cubic-bezier(0.36,0.07,0.19,0.97)' }
              if (ripple) { ripple.style.animation = 'none'; void ripple.getBoundingClientRect(); ripple.style.animation = 'ca-cursor-ripple 0.5s ease-out forwards' }
            }
          }
        }
      }

      // Row phase classes — managed imperatively so they survive SSR hydration ghost
      // refs that cause template :class bindings to update detached nodes after a scenario switch.
      const phases = dispPhases(m)
      panel.querySelectorAll<HTMLElement>('tbody tr').forEach((tr, i) => {
        tr.className = `ca-row ca-row--${phases[i] ?? 'idle'}`
      })

      // Table shells: Vue template owns --wide/--scrolling classes and the scroll chip.
      // We only drive the actual scrollTo behavior, which Vue can't express declaratively.
      panel.querySelectorAll<HTMLElement>('.ca-table-shell').forEach((shell, pIdx) => {
        const scrolling = pageHasPhase(phases, pIdx, 'col-scroll')
        if (isWide) {
          const wasScrolling = shell.dataset.scrolling === '1'
          if (scrolling !== wasScrolling) {
            shell.dataset.scrolling = scrolling ? '1' : '0'
            shell.scrollTo({ left: scrolling ? shell.scrollWidth : 0, behavior: 'smooth' })
          }
        } else if (shell.scrollLeft !== 0) {
          shell.scrollLeft = 0
        }
      })
    })
  }, { flush: 'post' })
})
</script>

<template>
  <div class="ca">

    <!-- Scenario tabs -->
    <div class="ca-scenarios">
      <button
        v-for="s in SCENARIOS" :key="s"
        class="ca-sc-btn"
        :class="{ 'ca-sc-btn--active': scenario === s }"
        :disabled="isRunning"
        @click="setScenario(s)"
      >{{ SCENARIO_LABELS[s] }}</button>
    </div>

    <!-- Toolbar -->
    <div class="ca-toolbar">
      <button class="ca-run-btn" :disabled="isRunning" @click="runAll">
        {{ isRunning ? 'Running…' : hasRun ? '↺ Run again' : '▶ Run all' }}
      </button>
      <div class="ca-speeds">
        <button
          v-for="s in SPEEDS" :key="s"
          class="ca-speed-btn"
          :class="{ 'ca-speed-btn--active': speed === s }"
          :disabled="isRunning"
          @click="speed = s"
        >{{ SPEED_LABELS[s] }}</button>
      </div>
    </div>

    <!-- Three panels — :key on the grid forces a full teardown+rebuild on every scenario
         switch, so no DOM, refs, or dynamic elements ever bleed between scenarios. -->
    <div class="ca-grid" :key="scenario">
      <div
        v-for="mode in MODES" :key="mode"
        class="ca-panel" :data-mode="mode"
        :class="{
          'ca-panel--rec':    isRecommended(mode) && !isBroken(mode),
          'ca-panel--dim':    isDim(mode),
          'ca-panel--broken': isBroken(mode),
        }"
      >
        <!-- Header -->
        <div class="ca-panel-head">
          <span class="ca-mode-label">{{ MODE_LABELS[mode] }}</span>
          <div class="ca-badges">
            <span v-if="isRecommended(mode)" class="ca-badge ca-badge--rec">recommended</span>
            <span v-if="isDim(mode)"         class="ca-badge ca-badge--same">same as parallel</span>
            <span v-if="isBroken(mode)" class="ca-badge ca-badge--warn">⚠ breaks here</span>
            <!-- Always in DOM as _createElementVNode so patchBlockChildren picks it up -->
            <span
              class="ca-elapsed"
              :class="{ 'ca-elapsed--running': elapsed[mode] === null }"
              :style="elapsed[mode] === null && !(isRunning && !isBroken(mode)) ? 'display:none' : ''"
            >{{ elapsed[mode] !== null ? elapsed[mode] + 'ms' : '…' }}</span>
          </div>
        </div>

        <!-- Code hint -->
        <div class="ca-code-hint">
          <span class="ca-root">table.</span><span class="ca-fn">{{ MODE_CODE[mode] }}</span>
        </div>

        <!-- Pages (always shown) -->
        <div class="ca-pages">
          <div v-for="(page, pIdx) in pageRows" :key="pIdx" class="ca-page">
            <div class="ca-page-label">Page {{ pIdx + 1 }}</div>
            <div
              class="ca-table-shell"
              :class="{
                'ca-table-shell--scrolling': pageHasPhase(dispPhases(mode), pIdx, 'col-scroll'),
                'ca-table-shell--wide': scenario === 'col-virtual',
              }"
            >
              <table class="ca-table">
                <thead>
                  <tr>
                    <th
                      v-for="col in COLS[scenario]" :key="col.key"
                      :class="{ 'ca-th--virtual': col.virtual }"
                    >{{ col.label }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, rIdx) in page" :key="row.name"
                    class="ca-row"
                  >
                    <td
                      v-for="col in COLS[scenario]" :key="col.key"
                      :class="{ 'ca-td--virtual': col.virtual, 'ca-td--user': col.key === 'user' }"
                    >
                      <span v-if="col.key === 'user'" class="ca-avatar">{{ row.initials }}</span>
                      <template v-else>{{ cellVal(row, col.key) }}</template>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="pageHasPhase(dispPhases(mode), pIdx, 'col-scroll')" class="ca-scroll-chip">
                ↔ scrolling…
              </div>
            </div>
          </div>
        </div>

        <p v-if="isDim(mode) && DIM_NOTE[scenario][mode]" class="ca-dim-note">
          {{ DIM_NOTE[scenario][mode] }}
        </p>

      </div>
    </div>

  </div>
</template>

<style scoped>
.ca { margin: 16px 0; }

/* Scenario tabs */
.ca-scenarios {
  display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px;
}
.ca-sc-btn {
  font-size: 0.71rem; font-weight: 600;
  padding: 4px 12px; border-radius: 7px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft); color: var(--vp-c-text-2);
  cursor: pointer; white-space: nowrap;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.ca-sc-btn:hover:not(:disabled) { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.ca-sc-btn--active {
  border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 9%, var(--vp-c-bg-soft));
}
.ca-sc-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Toolbar */
.ca-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.ca-run-btn {
  font-size: 0.76rem; font-weight: 700;
  padding: 5px 16px; border-radius: 7px;
  border: 1px solid var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 10%, var(--vp-c-bg-soft));
  color: var(--vp-c-brand-1); cursor: pointer; white-space: nowrap;
  transition: background 0.15s, opacity 0.15s;
}
.ca-run-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--vp-c-brand-1) 18%, var(--vp-c-bg-soft)); }
.ca-run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ca-speeds { display: flex; gap: 4px; flex-wrap: wrap; }
.ca-speed-btn {
  font-size: 0.68rem; font-weight: 600; padding: 3px 10px; border-radius: 6px;
  border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft); color: var(--vp-c-text-2);
  cursor: pointer; white-space: nowrap; transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.ca-speed-btn:hover:not(:disabled) { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.ca-speed-btn--active {
  border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 8%, var(--vp-c-bg-soft));
}
.ca-speed-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Grid */
.ca-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 900px) { .ca-grid { grid-template-columns: 1fr; } }

/* Panel */
.ca-panel {
  position: relative;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px; background: var(--vp-c-bg-soft);
  padding: 11px; display: flex; flex-direction: column; gap: 7px;
  transition: border-color 0.2s, opacity 0.2s;
}
.ca-panel--rec         { border-color: var(--vp-c-brand-1); }
.ca-panel--dim         { opacity: 0.65; }
.ca-panel--broken { border-color: color-mix(in srgb, #ef4444 45%, var(--vp-c-divider)); }

/* Panel header */
.ca-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.ca-mode-label { font-size: 0.76rem; font-weight: 700; color: var(--vp-c-text-1); }
.ca-badges     { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.ca-badge {
  font-size: 0.60rem; font-weight: 700; padding: 1px 6px; border-radius: 999px;
  white-space: nowrap; text-transform: uppercase; letter-spacing: 0.04em;
}
.ca-badge--rec  { background: color-mix(in srgb, var(--vp-c-brand-1) 14%, var(--vp-c-bg)); color: var(--vp-c-brand-1); border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 35%, transparent); }
.ca-badge--same { background: color-mix(in srgb, #94a3b8 12%, var(--vp-c-bg)); color: #94a3b8; border: 1px solid color-mix(in srgb, #94a3b8 30%, transparent); }
.ca-badge--warn { background: color-mix(in srgb, #f59e0b 13%, var(--vp-c-bg)); color: #d97706; border: 1px solid color-mix(in srgb, #f59e0b 35%, transparent); }
.ca-elapsed {
  font-size: 0.68rem; font-weight: 700; font-family: ui-monospace, monospace;
  padding: 1px 7px; border-radius: 999px;
  background: color-mix(in srgb, var(--vp-c-brand-1) 12%, var(--vp-c-bg));
  color: var(--vp-c-brand-1); border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 30%, transparent);
}
.ca-elapsed--running { opacity: 0.4; }

/* Code hint */
.ca-code-hint {
  font-family: ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 0.61rem; background: #1e1e1e; border: 1px solid #2d2d2d;
  border-radius: 6px; padding: 5px 9px; overflow-x: auto; white-space: nowrap;
}
.ca-root { color: #9cdcfe; }
.ca-fn   { color: #dcdcaa; }

/* Mouse cursor (scenario 3) — elements created dynamically, so styles must be :global */
:global(.ca-mouse-cursor) {
  position: absolute; top: 0; left: 0;
  pointer-events: none; z-index: 20; opacity: 0;
  transition: transform 0.20s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              opacity 0.15s ease;
}
:global(.ca-cursor-svg) {
  display: block;
  transform-origin: 3px 2px; /* arrow tip */
  filter:
    drop-shadow(0 2px 5px rgba(0,0,0,0.45))
    drop-shadow(0 0 8px rgba(99,102,241,0.35));
}
@keyframes ca-cursor-click {
  0%   { transform: scale(1);    }
  28%  { transform: scale(0.70); }
  55%  { transform: scale(0.88); }
  100% { transform: scale(1);    }
}
:global(.ca-cursor-ripple) {
  position: absolute;
  top: -4px; left: -4px;
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 1.5px solid #818cf8;
  opacity: 0;
  pointer-events: none;
}
@keyframes ca-cursor-ripple {
  0%   { transform: scale(0.4); opacity: 0.9; }
  100% { transform: scale(3.2); opacity: 0;   }
}

/* Active cell name (scenario 3) */
@keyframes ca-avatar-click {
  0%   { transform: scale(1);    opacity: 1;   }
  30%  { transform: scale(0.72); opacity: 0.5; }
  100% { transform: scale(0.6);  opacity: 0;   }
}
:global(.ca-avatar--clicking) {
  animation: ca-avatar-click 0.14s ease-in forwards;
  pointer-events: none;
}

@keyframes ca-name-pop {
  from { opacity: 0; transform: scale(0.82) translateX(-3px); }
  to   { opacity: 1; transform: scale(1)    translateX(0);    }
}
/* :global — dynamically created elements don't carry the Vue scope attribute */
:global(.ca-cell-name) {
  font-size: 0.67rem; font-weight: 600; white-space: nowrap;
  color: var(--vp-c-brand-1);
  display: inline-block;
}

/* Shake: applied inline to the page 1 table shell during broken tooltip reveal */
@keyframes ca-shake {
  0%   { transform: translateX(0); }
  12%  { transform: translateX(-5px) rotate(-0.4deg); }
  25%  { transform: translateX(5px)  rotate(0.4deg); }
  37%  { transform: translateX(-4px) rotate(-0.3deg); }
  50%  { transform: translateX(4px)  rotate(0.3deg); }
  62%  { transform: translateX(-2px); }
  75%  { transform: translateX(2px); }
  87%  { transform: translateX(-1px); }
  100% { transform: translateX(0); }
}

/* Pages */
.ca-pages { display: flex; flex-direction: column; gap: 5px; }
.ca-page-label {
  font-size: 0.60rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--vp-c-text-3); margin-bottom: 2px;
}

/* Table shell */
.ca-table-shell {
  position: relative;
  border: 1px solid color-mix(in srgb, var(--vp-c-divider) 80%, transparent);
  border-radius: 7px; overflow: hidden; background: var(--vp-c-bg);
  transition: border-color 0.2s;
}
.ca-table-shell--wide { overflow-x: auto; }
.ca-table-shell--wide .ca-table { min-width: 420px; }
.ca-table-shell--scrolling { border-color: #818cf8; }

/* Scroll chip overlay */
.ca-scroll-chip {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: color-mix(in srgb, #6366f1 88%, transparent);
  color: #fff; font-size: 0.62rem; font-weight: 600;
  padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  pointer-events: none;
}

/* Table */
.ca-table { width: 100%; border-collapse: collapse; font-size: 0.67rem; margin: 0; }
.ca-table th {
  padding: 4px 8px;
  background: color-mix(in srgb, var(--vp-c-bg-soft) 80%, var(--vp-c-bg));
  font-weight: 600; font-size: 0.59rem; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--vp-c-text-2); white-space: nowrap;
  border-bottom: 1px solid color-mix(in srgb, var(--vp-c-divider) 70%, transparent);
}
.ca-th--virtual { color: color-mix(in srgb, var(--vp-c-brand-1) 70%, var(--vp-c-text-2)); }
.ca-table td {
  padding: 4px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--vp-c-divider) 55%, transparent);
  white-space: nowrap; transition: background 0.12s, opacity 0.12s;
}
.ca-table tbody tr:last-child td { border-bottom: none; }
.ca-td--virtual { color: var(--vp-c-text-2); }
.ca-td--user    { text-align: center; min-width: 28px; }

/* Avatar — :global so it applies to both Vue-rendered and imperatively-created spans */
:global(.ca-avatar) {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  background: color-mix(in srgb, var(--vp-c-brand-1) 20%, var(--vp-c-bg-soft));
  color: var(--vp-c-brand-1); font-size: 0.58rem; font-weight: 700;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 30%, transparent);
  transition: background 0.15s, border-color 0.15s;
}

/* Row states */
.ca-row td { transition: background 0.12s, opacity 0.12s; }
.ca-row--visiting td {
  background: color-mix(in srgb, #6366f1 13%, var(--vp-c-bg));
}
.ca-row--visiting td:first-child { box-shadow: inset 3px 0 0 #818cf8; }
.ca-row--col-scroll td {
  background: color-mix(in srgb, #6366f1 8%, var(--vp-c-bg));
  opacity: 0.65;
}
.ca-row--hover td { background: color-mix(in srgb, #8b5cf6 13%, var(--vp-c-bg)); }
.ca-row--hover td:first-child { box-shadow: inset 3px 0 0 #8b5cf6; }
:global(.ca-row--hover .ca-avatar) {
  background: color-mix(in srgb, #8b5cf6 30%, var(--vp-c-bg-soft));
  border-color: #8b5cf6; color: #8b5cf6;
}
.ca-row--reading td { background: color-mix(in srgb, #22c55e 10%, var(--vp-c-bg)); }
.ca-row--reading td:first-child { box-shadow: inset 3px 0 0 #22c55e; }
.ca-row--done td { background: color-mix(in srgb, #16a34a 8%, var(--vp-c-bg)); }
.ca-row--done td:first-child { box-shadow: inset 3px 0 0 #22c55e; }
.ca-row--wrong td {
  background: color-mix(in srgb, #f59e0b 12%, var(--vp-c-bg));
  color: var(--vp-c-text-2);
}
.ca-row--wrong td:first-child { box-shadow: inset 3px 0 0 #f59e0b; }
.ca-row--conflict td {
  background: color-mix(in srgb, #ef4444 12%, var(--vp-c-bg));
  opacity: 0.7;
}
.ca-row--conflict td:first-child { box-shadow: inset 3px 0 0 #ef4444; }

/* Dim note */
.ca-dim-note {
  font-size: 0.67rem; line-height: 1.45; color: var(--vp-c-text-3);
  margin: 0; border-top: 1px solid var(--vp-c-divider); padding-top: 7px; font-style: italic;
}
</style>
