/// <reference path="../env.d.ts" />

import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import LabBeforeAfter from './components/lab/LabBeforeAfter.vue'
import LabBeforeAfterV2 from './components/lab/LabBeforeAfterV2.vue'
import LabQueryBuilder from './components/lab/LabQueryBuilder.vue'
import LabFindRowPaginationDebug from './components/lab/LabFindRowPaginationDebug.vue'
import LabInitGetRowDebug from './components/lab/LabInitGetRowDebug.vue'
import LabFeedbackMark from './components/lab/LabFeedbackMark.vue'
import LabGetRowTrace from './components/lab/LabGetRowTrace.vue'
import LabForEachTrace from './components/lab/LabForEachTrace.vue'
import LabPaginationSandbox from './components/lab/LabPaginationSandbox.vue'
import LabConcurrencyAnimator from './components/lab/LabConcurrencyAnimator.vue'
import HeaderMapping from './components/HeaderMapping.vue'
import PaginationStrategies from './components/PaginationStrategies.vue'
import TableAnatomy from './components/TableAnatomy.vue'
import MethodBadge from './components/MethodBadge.vue'
import ConfigSwatch from './components/ConfigSwatch.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LabBeforeAfter', LabBeforeAfter)
    app.component('LabBeforeAfterV2', LabBeforeAfterV2)
    app.component('LabQueryBuilder', LabQueryBuilder)
    app.component('LabFindRowPaginationDebug', LabFindRowPaginationDebug)
    app.component('LabInitGetRowDebug', LabInitGetRowDebug)
    app.component('LabFeedbackMark', LabFeedbackMark)
    app.component('LabGetRowTrace', LabGetRowTrace)
    app.component('LabForEachTrace', LabForEachTrace)
    app.component('LabPaginationSandbox', LabPaginationSandbox)
    app.component('LabConcurrencyAnimator', LabConcurrencyAnimator)
    app.component('HeaderMapping', HeaderMapping)
    app.component('PaginationStrategies', PaginationStrategies)
    app.component('TableAnatomy', TableAnatomy)
    app.component('MethodBadge', MethodBadge)
    app.component('ConfigSwatch', ConfigSwatch)
  }
} satisfies Theme
