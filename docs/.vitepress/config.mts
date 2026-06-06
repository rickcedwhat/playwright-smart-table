import { defineConfig } from 'vitepress'

export default defineConfig({
    title: "Playwright Smart Table",
    description: "Production-ready table testing for Playwright",
    base: '/playwright-smart-table/',
    themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/start' },
      { text: 'Examples', link: '/examples/' },
      { text: 'API', link: '/api/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
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
                { text: 'Header text', link: '/guide/describe/header-text' },
                { text: 'Editing cells', link: '/guide/describe/editing' },
                { text: 'Column overrides', link: '/guide/describe/column-overrides' },
              ]
            },
            {
              text: 'Query Your Table',
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
          text: 'API',
          items: [
            { text: 'Reference', link: '/api/' },
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
