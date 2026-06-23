import { defineConfig } from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'

export default defineConfig({
  markdown: {
    config(md) {
      md.use(tabsMarkdownPlugin)
    }
  },
    title: "Playwright Smart Table",
    description: "Production-ready table testing for Playwright",
    base: '/playwright-smart-table/',
    head: [
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:title', content: 'Playwright Smart Table' }],
      ['meta', { property: 'og:description', content: 'You describe your table. It does the rest.' }],
      ['meta', { property: 'og:image', content: 'https://rickcedwhat.github.io/playwright-smart-table/og.png' }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
      ['meta', { name: 'twitter:title', content: 'Playwright Smart Table' }],
      ['meta', { name: 'twitter:description', content: 'You describe your table. It does the rest.' }],
      ['meta', { name: 'twitter:image', content: 'https://rickcedwhat.github.io/playwright-smart-table/og.png' }],
    ],
    themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/start' },
      { text: 'Examples', link: '/examples/' },
      { text: 'API', link: '/api/' },
    ],

    sidebar: {
      '/guide/': [
        {
          items: [
            { text: 'Quick Start', link: '/guide/start' },
            {
              text: 'Describe Your Table',
              link: '/guide/describe/',
              collapsed: false,
              items: [
                { text: 'Where is your table?', link: '/guide/describe/locator' },
                { text: 'Headers, rows & cells', link: '/guide/describe/identify' },
                { text: 'Pagination', link: '/guide/describe/pagination' },
                { text: 'Virtualization', link: '/guide/describe/virtualization' },
                { text: 'Loading states', link: '/guide/describe/loading' },
                { text: 'Header text', link: '/guide/describe/header-text' },
                { text: 'Editing cells', link: '/guide/describe/editing' },
                { text: 'Column overrides', link: '/guide/describe/column-overrides' },
              ]
            },
            {
              text: 'Interact with Your Table',
              link: '/guide/query/',
              collapsed: false,
              items: [
                { text: 'Find rows', link: '/guide/query/find-rows' },
                { text: 'Read cells', link: '/guide/query/read-cells' },
                { text: 'Iterate rows', link: '/guide/query/iterate' },
                { text: 'Write to cells', link: '/guide/query/write' },
              ]
            },
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Config Options', link: '/api/table-config' },
            { text: 'Table Methods', link: '/api/table-methods' },
            { text: 'SmartRow', link: '/api/smart-row' },
            { text: 'Strategies', link: '/api/strategies' },
          ]
        }
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/rickcedwhat/playwright-smart-table' }
    ],

    search: {
      provider: 'local'
    }
  }
})
