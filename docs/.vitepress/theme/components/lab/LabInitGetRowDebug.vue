<script setup lang="ts">
import { buildColumnNotFoundError } from '../../../../../src/utils/stringUtils.ts'
import LabDebuggerWidget from './LabDebuggerWidget.vue'
import type { DebugVariablePane } from './LabDebuggerWidget.vue'

const headers = ['', 'Name', 'Role', 'Team', 'Office', 'Status']

const rows = [
  { '': '☐', Name: 'Airi Satou', Role: 'Accountant', Team: 'Finance', Office: 'Tokyo', Status: 'Active' },
  { '': '☐', Name: 'Bradley Greer', Role: 'Engineer', Team: 'Platform', Office: 'London', Status: 'Active' },
  { '': '☐', Name: 'Cedric Lane', Role: 'Analyst', Team: 'Ops', Office: 'Toronto', Status: 'Inactive' }
]

const codeLines = [
  'await table.init()',
  "const row = table.getRow({ Name: 'Airi Satou' })",
  "await expect(row.getCell('Office')).toHaveText('Tokyo')",
  "const rowTypo = table.getRow({ Naem: 'Airi Satou' })"
]

const headerMap = JSON.stringify(
  {
    __col_0: 0,
    Name: 1,
    Role: 2,
    Team: 3,
    Office: 4,
    Status: 5
  },
  null,
  2
)

const generatedLocator = [
  "const row = page.locator('tbody tr')",
  "  .filter({ has: page.locator('td').nth(1)",
  "    .filter({ hasText: 'Airi Satou' }) })",
  '  .first()'
].join('\n')

const typoError = buildColumnNotFoundError('Naem', headers)

const variables: DebugVariablePane[] = [
  { id: 'headerMap', label: 'headerMap', revealAtStep: 0, value: headerMap, kind: 'json', idleValue: '{}' },
  { id: 'generatedLocator', label: 'Playwright Translation', revealAtStep: 1, value: generatedLocator, kind: 'code', idleValue: '' },
  { id: 'assertResult', label: 'Result', revealAtStep: 2, value: '// True', kind: 'text', idleValue: '' },
  { id: 'error', label: 'error', revealAtStep: 3, value: typoError, kind: 'error', idleValue: '' }
]

const stepNotes = [
  'Initialize once so the header map is cached and future column lookups are stable.',
  'Resolve getRow criteria against the cached headers, then build a row locator from matching cells.',
  "Use regular Playwright assertions here because table methods return locators under the hood; this assertion resolves to true.",
  'A typo in the column key triggers a guided error with suggestions from the known header map.'
]
</script>

<template>
  <LabDebuggerWidget
    title="Init + getRow internals"
    :headers="headers"
    :rows="rows"
    :code-lines="codeLines"
    :variables="variables"
    :step-notes="stepNotes"
  />
</template>
