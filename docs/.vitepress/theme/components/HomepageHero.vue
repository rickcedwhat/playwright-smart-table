<script setup lang="ts">
import Without from '../homepage/without.md'
import With from '../homepage/with.md'

const GUIDE = '/playwright-smart-table/guide/start'
const EXAMPLES = '/playwright-smart-table/examples/'
</script>

<template>
  <div class="hp-hero">
    <h1 class="hp-title">Playwright Smart Table</h1>
    <p class="hp-hook">Dealing with tables sucks. Locators are brittle, hard to read, and break the moment a column moves or pagination kicks in.</p>
    <p class="hp-mid">Playwright Smart Table lets you find rows by column name instead of fragile DOM positions.</p>
    <p class="hp-sub">You describe your table. It does the rest.</p>
    <div class="hp-cta">
      <a :href="GUIDE" class="hp-btn-primary">Get Started</a>
      <a :href="EXAMPLES" class="hp-btn-secondary">See Examples</a>
    </div>
    <div class="hp-compare">
      <div class="hp-snippet hp-snippet--bad">
        <span class="hp-snippet-label">Before</span>
        <div class="hp-card"><Without /></div>
      </div>
      <div class="hp-snippet hp-snippet--good">
        <span class="hp-snippet-label hp-snippet-label--good">After</span>
        <div class="hp-card"><With /></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hp-hero {
  max-width: var(--vp-layout-max-width, 1440px);
  margin: 0 auto;
  padding: 40px 32px 48px;
  text-align: center;
}

.hp-title {
  font-size: clamp(2.4rem, 4.5vw, 3.6rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.035em;
  color: #49de80;
  margin: 0 0 1.5rem;
}

.hp-hook,
.hp-mid {
  font-size: 1.05rem;
  line-height: 1.7;
  color: var(--vp-c-text-2);
  max-width: 620px;
  margin: 0 auto 0.75rem;
}

.hp-sub {
  font-size: 1rem;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  margin: 0 auto 1.5rem;
}

.hp-cta { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

.hp-btn-primary {
  display: inline-flex; align-items: center; padding: 10px 22px; border-radius: 22px;
  background: var(--vp-c-brand-1); color: #fff !important; font-weight: 600; font-size: 14px;
  text-decoration: none !important; box-shadow: 0 6px 20px color-mix(in srgb, var(--vp-c-brand-1) 35%, transparent);
  transition: background .15s;
}
.hp-btn-primary:hover { background: var(--vp-c-brand-2); }
.hp-btn-secondary {
  display: inline-flex; align-items: center; padding: 10px 22px; border-radius: 22px;
  border: 1px solid var(--vp-c-border); color: var(--vp-c-text-1) !important; font-weight: 600; font-size: 14px;
  text-decoration: none !important; transition: border-color .15s;
}
.hp-btn-secondary:hover { border-color: var(--vp-c-brand-1); }

/* Before/After comparison */
.hp-compare {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 760px;
  margin: 40px auto 0;
}
@media (max-width: 640px) {
  .hp-card :deep(div[class*='language-'] code) {
    font-size: 12px;
    padding: 0 16px !important;
  }
}

.hp-snippet { display: flex; flex-direction: column; text-align: left; height: 100%; min-width: 0; }

/* The card — border / glow / background live here so equal-height is controllable */
.hp-card {
  min-width: 0;
  border-radius: 14px;
  overflow: hidden;
}
.hp-card :deep(div[class*='language-']) {
  min-width: 0;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}
.hp-card :deep(div[class*='language-'] pre) {
  padding: 22px 0 !important;
  margin: 0 !important;
  background: transparent !important;
  overflow-x: auto;
}
.hp-card :deep(div[class*='language-'] code) {
  padding: 0 28px !important;
  display: block;
}
.hp-card :deep(span.lang) { display: none; }

.hp-snippet--bad .hp-card {
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: linear-gradient(180deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02)), var(--vp-code-block-bg);
  box-shadow: 0 16px 40px rgba(239, 68, 68, 0.12), inset 0 1px 0 rgba(255,255,255,0.04);
}
.hp-snippet--good .hp-card {
  border: 1px solid rgba(34, 197, 94, 0.4);
  background: linear-gradient(180deg, rgba(34,197,94,0.1), rgba(34,197,94,0.02)), var(--vp-code-block-bg);
  box-shadow: 0 16px 44px rgba(34, 197, 94, 0.16), inset 0 1px 0 rgba(255,255,255,0.04);
}

.hp-snippet-label {
  display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  margin-bottom: 10px; padding: 3px 10px; border-radius: 6px;
}
.hp-snippet--bad .hp-snippet-label { color: #f87171; background: rgba(239, 68, 68, 0.12); }
.hp-snippet--bad .hp-snippet-label::before { content: '✕'; font-size: 10px; }
.hp-snippet--good .hp-snippet-label { color: #49de80; background: rgba(34, 197, 94, 0.12); }
.hp-snippet--good .hp-snippet-label::before { content: '✓'; font-size: 11px; }
</style>
