<script setup lang="ts">
import { ref, onMounted } from 'vue'

const STORE_KEY = '__homepage_option'
const current = ref(0)

onMounted(() => {
  const saved = localStorage.getItem(STORE_KEY)
  if (saved !== null) current.value = parseInt(saved)
})

function pick(n: number) {
  current.value = n
  localStorage.setItem(STORE_KEY, String(n))
}

const options = [
  { label: 'A', desc: 'Problem → proof → explain' },
  { label: 'B', desc: 'Build up → compare' },
  { label: 'C', desc: 'Leanest — cut the middle' },
]
</script>

<template>
  <div class="hp-options">
    <!-- picker bar -->
    <div class="hp-picker">
      <span class="hp-label">Homepage draft:</span>
      <button
        v-for="(opt, i) in options"
        :key="i"
        :class="['hp-btn', { active: current === i }]"
        @click="pick(i)"
      >
        {{ opt.label }}
        <span class="hp-desc">{{ opt.desc }}</span>
      </button>
    </div>

    <!-- Option A: Problem → visual proof → explanation -->
    <div v-show="current === 0" class="hp-content">
      <h1>Playwright Smart Table</h1>
      <p>Dealing with tables sucks. The locators involved are often ugly, brittle, and difficult to wrap your head around.</p>
      <p class="hp-cta-q">Which of these is easier to read?</p>
      <div class="hp-code-pair">
        <div class="hp-code-block">
          <span class="hp-code-label">Without</span>
          <pre><code>const row = page.locator('tbody tr')
  .filter(&#123; has: page.locator('td:nth-child(1)', &#123; hasText: 'John' &#125;) &#125;)
  .filter(&#123; has: page.locator('td:nth-child(2)', &#123; hasText: 'Doe' &#125;) &#125;)
const email = await row.locator('td:nth-child(3)').innerText()</code></pre>
        </div>
        <div class="hp-code-block">
          <span class="hp-code-label">With Playwright Smart Table</span>
          <pre><code>const row = table.getRow(&#123; firstName: 'John', lastName: 'Doe' &#125;)
const email = await row.getCell('Email').innerText()</code></pre>
        </div>
      </div>
      <p>What works today might not work tomorrow — a column moves, data pages over, or rows virtualize out of the DOM. And every table is different: semantic <code>&lt;table&gt;</code> is the exception, not the rule.</p>
      <p>Playwright Smart Table doesn't try to solve all of that automatically. Instead it gives you a way to describe how your specific table works — and then lets you ask questions against it in plain terms.</p>
      <p><strong>You describe your table. Playwright Smart Table does the rest.</strong></p>
      <p><a href="/guide/start">Get started</a> · <a href="/examples/">See examples</a></p>
    </div>

    <!-- Option B: Funnel — build up, then compare -->
    <div v-show="current === 1" class="hp-content">
      <h1>Playwright Smart Table</h1>
      <p>Dealing with tables sucks. The locators involved are often ugly, brittle, and difficult to wrap your head around.</p>
      <p>What works today might not work tomorrow — a column moves, data pages over, or rows virtualize out of the DOM. And every table is different: semantic <code>&lt;table&gt;</code> is the exception, not the rule. You're more likely dealing with a <code>&lt;div&gt;</code>-based grid where the library author made all their own decisions about structure, attributes, and behavior.</p>
      <p class="hp-cta-q">Which of these is easier to read?</p>
      <div class="hp-code-pair">
        <div class="hp-code-block">
          <span class="hp-code-label">Without</span>
          <pre><code>const row = page.locator('tbody tr')
  .filter(&#123; has: page.locator('td:nth-child(1)', &#123; hasText: 'John' &#125;) &#125;)
  .filter(&#123; has: page.locator('td:nth-child(2)', &#123; hasText: 'Doe' &#125;) &#125;)
const email = await row.locator('td:nth-child(3)').innerText()</code></pre>
        </div>
        <div class="hp-code-block">
          <span class="hp-code-label">With Playwright Smart Table</span>
          <pre><code>const row = table.getRow(&#123; firstName: 'John', lastName: 'Doe' &#125;)
const email = await row.getCell('Email').innerText()</code></pre>
        </div>
      </div>
      <p>Playwright Smart Table doesn't try to solve all of that automatically. Instead it gives you a way to describe how your specific table works — and then lets you ask questions against it in plain terms.</p>
      <p><strong>You describe your table. Playwright Smart Table does the rest.</strong></p>
      <p><a href="/guide/start">Get started</a> · <a href="/examples/">See examples</a></p>
    </div>

    <!-- Option C: Leanest — cut the middle -->
    <div v-show="current === 2" class="hp-content">
      <h1>Playwright Smart Table</h1>
      <p>Dealing with tables sucks. The locators involved are often ugly, brittle, and difficult to wrap your head around.</p>
      <p class="hp-cta-q">Which of these is easier to read?</p>
      <div class="hp-code-pair">
        <div class="hp-code-block">
          <span class="hp-code-label">Without</span>
          <pre><code>const row = page.locator('tbody tr')
  .filter(&#123; has: page.locator('td:nth-child(1)', &#123; hasText: 'John' &#125;) &#125;)
  .filter(&#123; has: page.locator('td:nth-child(2)', &#123; hasText: 'Doe' &#125;) &#125;)
const email = await row.locator('td:nth-child(3)').innerText()</code></pre>
        </div>
        <div class="hp-code-block">
          <span class="hp-code-label">With Playwright Smart Table</span>
          <pre><code>const row = table.getRow(&#123; firstName: 'John', lastName: 'Doe' &#125;)
const email = await row.getCell('Email').innerText()</code></pre>
        </div>
      </div>
      <p>Playwright Smart Table gives you a way to describe how your specific table works — and then lets you ask questions against it in plain terms. Works for standard HTML tables, div-based grids, paginated tables, and virtualized ones.</p>
      <p><strong>You describe your table. Playwright Smart Table does the rest.</strong></p>
      <p><a href="/guide/start">Get started</a> · <a href="/examples/">See examples</a></p>
    </div>
  </div>
</template>

<style scoped>
.hp-options {
  max-width: 800px;
  margin: 0 auto;
}
.hp-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 32px;
  padding: 10px 14px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  flex-wrap: wrap;
}
.hp-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  margin-right: 4px;
}
.hp-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.hp-btn:hover { background: var(--vp-c-bg-mute); }
.hp-btn.active {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.hp-desc {
  font-size: 11px;
  font-weight: 400;
  color: var(--vp-c-text-3);
}
.hp-btn.active .hp-desc { color: var(--vp-c-brand-2); }

.hp-content h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1rem;
}
.hp-content p {
  line-height: 1.7;
  margin-bottom: 1rem;
  color: var(--vp-c-text-1);
}
.hp-cta-q {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--vp-c-text-1) !important;
  margin-top: 1.5rem !important;
}
.hp-code-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 1rem 0 1.5rem;
}
@media (max-width: 640px) {
  .hp-code-pair { grid-template-columns: 1fr; }
}
.hp-code-block {
  background: var(--vp-code-block-bg);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--vp-c-border);
}
.hp-code-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--vp-c-text-3);
  padding: 6px 12px 4px;
  border-bottom: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
}
.hp-code-block pre {
  margin: 0;
  padding: 12px;
  overflow-x: auto;
  background: transparent;
}
.hp-code-block pre code {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  background: transparent;
  padding: 0;
}
.hp-content a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 500;
}
.hp-content a:hover { text-decoration: underline; }
</style>
