<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LabDebuggerWidget from './LabDebuggerWidget.vue'
import type { DebugPagerButton, DebugVariablePane } from './LabDebuggerWidget.vue'

const activeStep = ref<number | null>(null)

const headers = ['', 'Name', 'Role', 'Office', 'Status']
const pages: Array<Array<Record<string, string>>> = [
  [
    { '': '☐', Name: 'Nora Fields', Role: 'Analyst', Office: 'Berlin', Status: 'Active' },
    { '': '☐', Name: 'Eli Brooks', Role: 'Engineer', Office: 'London', Status: 'Active' },
    { '': '☐', Name: 'Sara Wren', Role: 'QA', Office: 'Paris', Status: 'Active' }
  ],
  [
    { '': '☐', Name: 'Ivan Cross', Role: 'Manager', Office: 'Tokyo', Status: 'Active' },
    { '': '☐', Name: 'Pia Stone', Role: 'Engineer', Office: 'Madrid', Status: 'Active' },
    { '': '☐', Name: 'Leah Finch', Role: 'Analyst', Office: 'Dublin', Status: 'Active' }
  ],
  [
    { '': '☐', Name: 'Omar Hall', Role: 'Support', Office: 'Lisbon', Status: 'Active' },
    { '': '☐', Name: 'Tina Vale', Role: 'Engineer', Office: 'Seoul', Status: 'Active' },
    { '': '☐', Name: 'Gina Park', Role: 'Designer', Office: 'Osaka', Status: 'Active' }
  ],
  [
    { '': '☐', Name: 'Mina Patel', Role: 'Analyst', Office: 'Tokyo', Status: 'Active' },
    { '': '☐', Name: 'Jonas Reed', Role: 'Engineer', Office: 'London', Status: 'Active' },
    { '': '☐', Name: 'Asha Cole', Role: 'QA', Office: 'Paris', Status: 'Active' }
  ],
  [
    { '': '☐', Name: 'Rey Voss', Role: 'QA', Office: 'Toronto', Status: 'Active' },
    { '': '☐', Name: 'Moe Trent', Role: 'Ops', Office: 'Rome', Status: 'Active' },
    { '': '☐', Name: 'Kira Song', Role: 'Engineer', Office: 'Sydney', Status: 'Active' }
  ]
]

const TARGET_NAME = 'Mina Patel'
const target = (() => {
  for (let p = 0; p < pages.length; p++) {
    const r = pages[p].findIndex(row => row.Name === TARGET_NAME)
    if (r !== -1) return { pageIndex: p, rowIndex: r }
  }
  return { pageIndex: 3, rowIndex: 0 } // Fallback
})()

const MATCH_PAGE_INDEX = target.pageIndex
const MATCH_ROW_INDEX = target.rowIndex

const currentPage = ref(0)
const cellClassMap = ref<Record<string, string>>({})
const pagerPulseTarget = ref<string | null>(null)
const pagerTraceHeader = `Pager controls: Prev ${pages.map((_, i) => i + 1).join(' ')} Next`
const traceLines = ref<string[]>([pagerTraceHeader, 'Ready to scan pages'])
/** When true, step-3 context shows only Playwright row locator (trace stays in commentary / animation only). */
const findRowTraceSettled = ref(false)
let scanRunId = 0

const codeLines = [
  "const table = useTable(page.locator('#employees'), config)",
  'await table.init()',
  "const row = await table.findRow({ Name: 'Mina Patel' }, { maxPages: 5 })",
  "await row.getCell('Select').getByRole('checkbox').check()"
]

const headerMapJson = JSON.stringify(
  {
    Select: 0,
    Name: 1,
    Role: 2,
    Office: 3,
    Status: 4
  },
  null,
  2
)

const findRowLocatorOneLine =
  "await page.locator('tbody tr').filter({ has: page.locator('td').nth(1).filter({ hasText: 'Mina Patel' }) }).first()"

const configSnippet = [
  "const config = {",
  "  rowSelector: 'tbody tr',",
  "  headerSelector: 'thead th',",
  "  cellSelector: 'td',",
  '  strategies: {',
  '    pagination: Strategies.Pagination.click({',
  "      prev: '.pager [aria-label=\"Prev\"]',",
  "      next: '.pager [aria-label=\"Next\"]'",
  '    })',
  '  },',
  '  headerTransformer: ({ text }) => {',
  "    if (text.trim() === '' || text.includes('__col_')) return 'Select'",
  '    return text',
  '  }',
  '}'
].join('\n')

const paginationTraceText = computed(() => traceLines.value.join('\n'))

/** Keep full pagination trace; after match, append locator (do not replace trace). */
const findRowTraceAndLocator = computed(() => {
  const trace = paginationTraceText.value
  if (!findRowTraceSettled.value) return trace
  return [trace, '', 'Playwright translation (row locator):', findRowLocatorOneLine].join('\n')
})

const checkboxAction =
  'await row.locator(\'td\').nth(0).getByRole(\'checkbox\').check()'

const variables = computed<DebugVariablePane[]>(() => [
  { id: 'config', label: 'config', revealAtStep: 0, value: configSnippet, kind: 'code', idleValue: '' },
  { id: 'headerMap', label: 'headerMap', revealAtStep: 1, value: headerMapJson, kind: 'json', idleValue: '{}' },
  {
    id: 'findRowDual',
    label: 'findRow trace',
    revealAtStep: 2,
    value: findRowTraceAndLocator.value,
    kind: 'text',
    idleValue: ''
  },
  { id: 'checkboxAction', label: 'Playwright Translation', revealAtStep: 3, value: checkboxAction, kind: 'code', idleValue: '' }
])

const stepNotes = [
  'Wire useTable with click pagination + headerTransformer (see config pane on line 1).',
  'Note: __col_0 was converted to Select using headerTransformer.',
  `findRow paginates until a row matches Name. Trace lines stay visible; once the match settles, Playwright translation for the row locator is appended. TableResult.currentPageIndex stays in sync (${MATCH_PAGE_INDEX} here = 0-based page for this row → pager highlights "4").`,
  'getCell resolves to locators scoped under the matched row.'
]

const rows = computed(() => {
  return pages[currentPage.value].map((row, idx) => {
    if (activeStep.value !== null && activeStep.value >= 3 && currentPage.value === MATCH_PAGE_INDEX && idx === MATCH_ROW_INDEX) {
      return { ...row, '': '☑' }
    }
    return row
  })
})

const pagerButtons = computed<DebugPagerButton[]>(() => {
  const buttons: DebugPagerButton[] = [
    {
      label: 'Prev',
      disabled: currentPage.value === 0,
      pulse: pagerPulseTarget.value === 'Prev'
    }
  ]
  for (let i = 0; i < pages.length; i += 1) {
    buttons.push({ label: `${i + 1}`, active: currentPage.value === i })
  }
  buttons.push({
    label: 'Next',
    disabled: currentPage.value === pages.length - 1,
    pulse: pagerPulseTarget.value === 'Next'
  })
  return buttons
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clearScanVisuals() {
  cellClassMap.value = {}
}

async function pulseNextButton(runId: number) {
  pagerPulseTarget.value = 'Next'
  await sleep(280)
  if (runId === scanRunId) pagerPulseTarget.value = null
}

async function animateFindRowScan(step: number) {
  const runId = ++scanRunId
  clearScanVisuals()
  currentPage.value = 0
  pagerPulseTarget.value = null
  traceLines.value = [pagerTraceHeader, 'Ready to scan pages']

  findRowTraceSettled.value = step > 2
  if (step < 2) {
    findRowTraceSettled.value = false
    return
  }

  findRowTraceSettled.value = step > 2
  if (step === 2) findRowTraceSettled.value = false

  if (step > 2) {
    currentPage.value = MATCH_PAGE_INDEX
    cellClassMap.value = {
      [`${MATCH_ROW_INDEX}:Name`]: 'dbg-cell--match',
    }
    // Set misses for other rows on that page if any
    pages[MATCH_PAGE_INDEX].forEach((_, i) => {
        if (i !== MATCH_ROW_INDEX) cellClassMap.value[`${i}:Name`] = 'dbg-cell--miss'
    })

    traceLines.value = [
      pagerTraceHeader,
      ...Array.from({ length: MATCH_PAGE_INDEX }, (_, i) => `Page ${i + 1} scanned -> no match`),
      `Page ${MATCH_PAGE_INDEX + 1} scanned -> ${TARGET_NAME} matched`,
      `table.currentPageIndex === ${MATCH_PAGE_INDEX}`
    ]
    return
  }

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx += 1) {
    if (runId !== scanRunId) return
    currentPage.value = pageIdx
    clearScanVisuals()
    traceLines.value = [
      pagerTraceHeader,
      ...Array.from({ length: pageIdx }, (_, i) => `Page ${i + 1} scanned -> no match`),
      `Scanning page ${pageIdx + 1}...`
    ]
    await sleep(320)
    if (runId !== scanRunId) return

    const pageMap: Record<string, string> = {}
    let foundOnPage = false
    for (let rowIdx = 0; rowIdx < pages[pageIdx].length; rowIdx += 1) {
      const key = `${rowIdx}:Name`
      const isMatch = pages[pageIdx][rowIdx]?.Name === TARGET_NAME
      pageMap[key] = isMatch ? 'dbg-cell--match' : 'dbg-cell--miss'
      if (isMatch) foundOnPage = true
    }
    cellClassMap.value = pageMap
    await sleep(foundOnPage ? 520 : 360)
    if (runId !== scanRunId) return

    if (foundOnPage) {
      traceLines.value = [
        pagerTraceHeader,
        ...Array.from({ length: pageIdx }, (_, i) => `Page ${i + 1} scanned -> no match`),
        `Page ${pageIdx + 1} scanned -> ${TARGET_NAME} matched`,
        `table.currentPageIndex === ${pageIdx}`
      ]
      findRowTraceSettled.value = true
      return
    }

    traceLines.value = [
      pagerTraceHeader,
      ...Array.from({ length: pageIdx + 1 }, (_, i) => `Page ${i + 1} scanned -> no match`)
    ]

    if (pageIdx < pages.length - 1) {
      traceLines.value = [...traceLines.value, 'Clicking Next...']
      await pulseNextButton(runId)
      if (runId !== scanRunId) return
      traceLines.value = [
        pagerTraceHeader,
        ...Array.from({ length: pageIdx + 1 }, (_, i) => `Page ${i + 1} scanned -> no match`),
        `Moved to page ${pageIdx + 2}`
      ]
      await sleep(180)
      if (runId !== scanRunId) return
    }
  }
}

watch(
  activeStep,
  (step) => {
    void animateFindRowScan(step ?? -1)
  },
  { immediate: true }
)
</script>

<template>
  <div class="fr-demo">
    <LabDebuggerWidget
      title="findRow + pagination + checkbox"
      :headers="headers"
      :rows="rows"
      :pager-buttons="pagerButtons"
      :cell-class-map="cellClassMap"
      :code-lines="codeLines"
      :variables="variables"
      :step-notes="stepNotes"
      :persist-previous-context="false"
      @step-change="(step) => (activeStep = step)"
    />
  </div>
</template>

<style scoped>
.fr-demo {
  margin-top: 12px;
}
</style>
