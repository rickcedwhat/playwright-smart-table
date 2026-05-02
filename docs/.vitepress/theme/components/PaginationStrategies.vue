<script setup lang="ts">
import { computed, ref } from 'vue'

type StrategyKey = 'next' | 'first' | 'page' | 'infinite'

const active = ref<StrategyKey>('next')

const strategies: Array<{
  key: StrategyKey
  title: string
  code: string
  detail: string
}> = [
  {
    key: 'next',
    title: 'Next / Previous buttons',
    code: "Strategies.Pagination.click({ next, previous })",
    detail: 'Use this for classic pagination components where Smart Table can click one page at a time.'
  },
  {
    key: 'first',
    title: 'Reset to page one',
    code: 'goToFirst: async (context) => { ... }',
    detail: 'Add goToFirst when the table can jump back before a new scan or reset.'
  },
  {
    key: 'page',
    title: 'Direct page jumps',
    code: 'goToPage: async (pageIndex, context) => { ... }',
    detail: 'Use goToPage when the UI exposes numbered pages or an input for a target page.'
  },
  {
    key: 'infinite',
    title: 'Infinite scroll / load more',
    code: 'Strategies.Pagination.infiniteScroll(...)',
    detail: 'Use this when the strategy scrolls or loads more content and new rows are appended to the table.'
  }
]

const activeStrategy = computed(() => strategies.find((strategy) => strategy.key === active.value) ?? strategies[0])

function setActive(key: StrategyKey) {
  active.value = key
}
</script>

<template>
  <div class="pagination-strategies">
    <section class="strategy-list" aria-label="Pagination strategy examples">
      <div class="panel-heading">
        <span class="eyebrow">Strategies</span>
        <strong>Hover a pagination shape</strong>
      </div>

      <button
        v-for="strategy in strategies"
        :key="strategy.key"
        type="button"
        class="strategy-card"
        :class="{ active: active === strategy.key }"
        :aria-pressed="active === strategy.key"
        @focus="setActive(strategy.key)"
        @mouseenter="setActive(strategy.key)"
        @click="setActive(strategy.key)"
      >
        <span>{{ strategy.title }}</span>
        <code>{{ strategy.code }}</code>
      </button>
    </section>

    <section class="visual-panel" aria-label="Pagination UI preview">
      <div class="panel-heading">
        <span class="eyebrow">Table Footer</span>
        <strong>{{ activeStrategy.title }}</strong>
        <p>{{ activeStrategy.detail }}</p>
      </div>

      <div class="table-card" :class="{ infinite: active === 'infinite' }">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Office</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Airi Satou</td>
              <td>Tokyo</td>
              <td>Active</td>
            </tr>
            <tr>
              <td>Brielle Williamson</td>
              <td>New York</td>
              <td>Active</td>
            </tr>
            <tr v-if="active === 'infinite'" class="loaded-row delay-one">
              <td>Cedric Kelly</td>
              <td>Edinburgh</td>
              <td>Review</td>
            </tr>
            <tr v-if="active === 'infinite'" class="loaded-row delay-two">
              <td>Doris Wilder</td>
              <td>Sydney</td>
              <td>Active</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <template v-if="active === 'next'">
            <span class="pill highlight">Previous</span>
            <span>Page 1 of 5</span>
            <span class="pill highlight">Next</span>
          </template>

          <template v-else-if="active === 'first'">
            <span class="pill highlight">First</span>
            <span class="pill">Previous</span>
            <span>Page 3 of 5</span>
            <span class="pill">Next</span>
          </template>

          <template v-else-if="active === 'page'">
            <span class="page-number">1</span>
            <span class="page-number highlight">2</span>
            <span class="page-number">3</span>
            <span class="page-number">4</span>
            <span class="page-number">5</span>
          </template>

          <template v-else>
            <span class="scroll-hint">
              <span class="scroll-window">
                <span class="scroll-thumb highlight"></span>
              </span>
              <span>Scroll reached bottom</span>
            </span>
            <span class="pill highlight">Rows appended</span>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pagination-strategies {
  display: grid;
  grid-template-columns: minmax(340px, 0.9fr) minmax(520px, 1.45fr);
  gap: 32px;
  margin: 36px 0;
}

.panel-heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.panel-heading p {
  margin: 0;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

.eyebrow {
  color: var(--vp-c-brand-1);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.strategy-list {
  min-width: 0;
}

.strategy-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-bottom: 10px;
  padding: 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background: transparent;
  color: var(--vp-c-text-1);
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.strategy-card:hover,
.strategy-card:focus,
.strategy-card.active {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 70%, var(--vp-c-divider));
  background: color-mix(in srgb, var(--vp-c-brand-1) 12%, var(--vp-c-bg-soft));
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--vp-c-brand-1) 32%, transparent);
  outline: none;
}

.strategy-card span {
  font-weight: 700;
}

.strategy-card code {
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 0.78rem;
}

.table-card {
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
}

.table-card.infinite {
  position: relative;
}

table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 0.88rem;
}

th,
td {
  padding: 12px;
  border-right: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}

th:last-child,
td:last-child {
  border-right: 0;
}

th {
  background: color-mix(in srgb, var(--vp-c-brand-1) 10%, var(--vp-c-bg-soft));
  color: var(--vp-c-text-1);
  text-align: left;
}

td {
  color: var(--vp-c-text-2);
}

.loaded-row {
  animation: append-row 900ms ease both;
}

.delay-one {
  animation-delay: 160ms;
}

.delay-two {
  animation-delay: 420ms;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px;
  color: var(--vp-c-text-2);
}

.pill,
.page-number {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.pill {
  border-radius: 999px;
  padding: 7px 13px;
}

.page-number {
  width: 34px;
  height: 34px;
  border-radius: 12px;
}

.scroll-hint {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.scroll-window {
  position: absolute;
  right: 12px;
  top: 54px;
  bottom: 70px;
  width: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--vp-c-text-2) 18%, transparent);
}

.scroll-thumb {
  position: absolute;
  left: -4px;
  top: 10px;
  width: 16px;
  height: 48px;
  border-radius: 999px;
  animation: scroll-down 1.5s ease-in-out infinite;
}

.highlight {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 72%, var(--vp-c-divider));
  background: color-mix(in srgb, var(--vp-c-brand-1) 18%, var(--vp-c-bg-soft));
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--vp-c-brand-1) 44%, transparent);
}

@keyframes scroll-down {
  0%,
  22% {
    transform: translateY(0);
  }

  70%,
  100% {
    transform: translateY(54px);
  }
}

@keyframes append-row {
  from {
    opacity: 0;
    transform: translateY(10px);
    background: color-mix(in srgb, var(--vp-c-brand-1) 24%, var(--vp-c-bg-soft));
  }

  to {
    opacity: 1;
    transform: translateY(0);
    background: transparent;
  }
}

@media (max-width: 900px) {
  .pagination-strategies {
    grid-template-columns: 1fr;
  }
}
</style>
