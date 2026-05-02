/// <reference path="../env.d.ts" />

import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import LabBeforeAfter from './components/lab/LabBeforeAfter.vue'
import LabBeforeAfterV2 from './components/lab/LabBeforeAfterV2.vue'
import LabQueryBuilder from './components/lab/LabQueryBuilder.vue'
import LabDebugPlayback from './components/lab/LabDebugPlayback.vue'
import LabFailureStates from './components/lab/LabFailureStates.vue'
import LabFindRowPaginationDebug from './components/lab/LabFindRowPaginationDebug.vue'
import LabInitGetRowDebug from './components/lab/LabInitGetRowDebug.vue'
import LabFeedbackMark from './components/lab/LabFeedbackMark.vue'
import LabMethodWalkthrough from './components/lab/LabMethodWalkthrough.vue'
import LabStrategyPicker from './components/lab/LabStrategyPicker.vue'
import LabTableTypeGallery from './components/lab/LabTableTypeGallery.vue'
import LabGetRowTrace from './components/lab/LabGetRowTrace.vue'
import LabForEachTrace from './components/lab/LabForEachTrace.vue'
import LabPaginationSandbox from './components/lab/LabPaginationSandbox.vue'
import HeaderMapping from './components/HeaderMapping.vue'
import PaginationStrategies from './components/PaginationStrategies.vue'
import TableAnatomy from './components/TableAnatomy.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LabBeforeAfter', LabBeforeAfter)
    app.component('LabBeforeAfterV2', LabBeforeAfterV2)
    app.component('LabQueryBuilder', LabQueryBuilder)
    app.component('LabDebugPlayback', LabDebugPlayback)
    app.component('LabFailureStates', LabFailureStates)
    app.component('LabFindRowPaginationDebug', LabFindRowPaginationDebug)
    app.component('LabInitGetRowDebug', LabInitGetRowDebug)
    app.component('LabFeedbackMark', LabFeedbackMark)
    app.component('LabMethodWalkthrough', LabMethodWalkthrough)
    app.component('LabStrategyPicker', LabStrategyPicker)
    app.component('LabTableTypeGallery', LabTableTypeGallery)
    app.component('LabGetRowTrace', LabGetRowTrace)
    app.component('LabForEachTrace', LabForEachTrace)
    app.component('LabPaginationSandbox', LabPaginationSandbox)
    app.component('HeaderMapping', HeaderMapping)
    app.component('PaginationStrategies', PaginationStrategies)
    app.component('TableAnatomy', TableAnatomy)
  }
} satisfies Theme
