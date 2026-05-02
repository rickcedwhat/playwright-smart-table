<script setup lang="ts">
import { withBase } from 'vitepress'

const cards: { slug: string; label: string; href: string; title: string; blurb: string }[] = [
  {
    slug: 'table-gallery.basic',
    label: 'HTML table card',
    href: '/examples/basic',
    title: 'HTML table',
    blurb: 'Default selectors, fast path.'
  },
  {
    slug: 'table-gallery.pagination',
    label: 'Pagination card',
    href: '/examples/pagination',
    title: 'Paginated DOM table',
    blurb: 'Next/Previous or numbered pages.'
  },
  {
    slug: 'table-gallery.infinite-scroll',
    label: 'Infinite scroll card',
    href: '/examples/infinite-scroll',
    title: 'Infinite scroll',
    blurb: 'Load more / scroll for rows.'
  },
  {
    slug: 'table-gallery.mui',
    label: 'MUI DataGrid card',
    href: '/examples/mui-datagrid',
    title: 'MUI DataGrid',
    blurb: 'Div grid + preset strategies.'
  },
  {
    slug: 'table-gallery.ag-grid',
    label: 'AG Grid card',
    href: '/examples/ag-grid',
    title: 'AG Grid',
    blurb: 'Virtualized cells, custom pagination.'
  }
]
</script>

<template>
  <div class="lab-gallery">
    <div v-for="c in cards" :key="c.href" class="card-shell">
      <div class="card-title-row">
        <a class="card-title" :href="withBase(c.href)">{{ c.title }}</a>
        <LabFeedbackMark :slug="c.slug" :label="c.label" compact />
      </div>
      <a class="card-desc" :href="withBase(c.href)">{{ c.blurb }}</a>
    </div>
  </div>
</template>

<style scoped>
.lab-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin: 20px 0;
}
.card-shell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--vp-c-divider);
  transition: border-color 0.15s, background 0.15s;
}
.card-shell:hover {
  border-color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 8%, var(--vp-c-bg-soft));
}
.card-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.card-title {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  color: inherit;
  line-height: 1.2;
}
.card-title:hover {
  color: var(--vp-c-brand-1);
}
.card-desc {
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
  line-height: 1.45;
  text-decoration: none;
}
.card-desc:hover {
  color: var(--vp-c-text-1);
}
</style>
