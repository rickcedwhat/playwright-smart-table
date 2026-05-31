import { defineConfig } from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'

/** Draft Lab (docs/lab): included in `docs:dev`; omitted from `docs:build` via scripts/docs-build-prod.mjs (sets LAB_PAGES=0). */
const includeLabPages = process.env.LAB_PAGES !== '0'

const presetSidebar = [
    {
        text: 'Presets (maintainers)',
        items: [
            { text: 'Preset development', link: '/PRESET_DEVELOPMENT' },
            { text: 'Preset template', link: '/PRESET_TEMPLATE' },
            { text: '← Advanced overview', link: '/advanced/' }
        ]
    }
]

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
            { text: 'Guide', link: '/guide/getting-started' },
            ...(includeLabPages ? ([{ text: 'Lab', link: '/lab/' }] as const) : []),
            { text: 'API', link: '/api/' },
            { text: 'Examples', link: '/examples/' },
            { text: 'Help', link: '/troubleshooting' }
        ],

        sidebar: {
            '/guide/': [
                {
                    text: 'Guide',
                    items: [
                        { text: 'Getting Started', link: '/guide/getting-started' },
                        { text: 'Why Smart Table?', link: '/guide/why' },
                        { text: 'Filtering & Queries', link: '/guide/filtering' },
                        { text: 'Configuration', link: '/guide/configuration' },
                        {
                            text: 'How It Works',
                            collapsed: true,
                            items: [
                                { text: 'Table Anatomy', link: '/guide/table-anatomy' },
                                { text: 'Header Mapping', link: '/guide/header-mapping' },
                                { text: 'Pagination', link: '/guide/pagination' },
                                { text: 'Strategies', link: '/guide/strategies' },
                                { text: 'Concurrency Modes', link: '/guide/concurrency' },
                            ]
                        },
                        {
                            text: 'Advanced',
                            collapsed: true,
                            items: [
                                { text: 'Custom Resolution', link: '/advanced/custom-resolution' },
                                { text: 'TypeScript Tips', link: '/advanced/typescript' },
                                { text: 'Custom Strategies', link: '/advanced/custom-strategies' },
                                { text: 'Performance Tips', link: '/advanced/performance' },
                                { text: 'Preset Development', link: '/PRESET_DEVELOPMENT' },
                                { text: 'Preset Template', link: '/PRESET_TEMPLATE' }
                            ]
                        }
                    ]
                }
            ],
            ...(includeLabPages
                ? {
                      '/lab/': [
                          {
                              text: 'Lab (draft)',
                              items: [{ text: 'Rough drafts', link: '/lab/' }]
                          }
                      ]
                  }
                : {}),
            '/examples/': [
                {
                    text: 'Examples',
                    items: [
                        { text: 'Overview', link: '/examples/' },
                        { text: 'Basic Usage', link: '/examples/basic' },
                        { text: 'Pagination', link: '/examples/pagination' },
                        { text: 'Infinite Scroll', link: '/examples/infinite-scroll' },
                        { text: 'MUI DataGrid', link: '/examples/mui-datagrid' },
                        { text: 'AG Grid', link: '/examples/ag-grid' },
                        { text: 'Data Scraping', link: '/examples/data-scraping' },
                    ]
                }
            ],
            '/api/': [
                {
                    text: 'API',
                    items: [
                        { text: 'Overview', link: '/api/' },
                        {
                            text: 'TableConfig',
                            link: '/api/table-config',
                            collapsed: false,
                            items: [
                                { text: 'columnOverrides', link: '/api/table-config#columnoverrides' },
                                { text: 'headerSelector', link: '/api/table-config#headerselector' },
                                { text: 'rowSelector', link: '/api/table-config#rowselector' },
                                { text: 'cellSelector', link: '/api/table-config#cellselector' },
                                { text: 'maxPages', link: '/api/table-config#maxpages' },
                                { text: 'concurrency', link: '/api/table-config#concurrency' },
                                { text: 'headerTransformer', link: '/api/table-config#headertransformer' },
                                { text: 'strategies', link: '/api/table-config#strategies' },
                                { text: 'autoScroll', link: '/api/table-config#autoscroll' },
                                { text: 'onReset', link: '/api/table-config#onreset' },
                                { text: 'debug', link: '/api/table-config#debug' }
                            ]
                        },
                        {
                            text: 'Table Methods',
                            link: '/api/table-methods',
                            collapsed: false,
                            items: [
                                { text: 'init()', link: '/api/table-methods#init' },
                                { text: 'isInitialized()', link: '/api/table-methods#isinitialized' },
                                { text: 'getRow()', link: '/api/table-methods#getrow' },
                                { text: 'getRowByIndex()', link: '/api/table-methods#getrowbyindex' },
                                { text: 'findRow()', link: '/api/table-methods#findrow' },
                                { text: 'findRows()', link: '/api/table-methods#findrows' },
                                { text: 'forEach()', link: '/api/table-methods#foreach' },
                                { text: 'map()', link: '/api/table-methods#map' },
                                { text: 'filter()', link: '/api/table-methods#filter' },
                                {
                                    text: 'Async iterator',
                                    link: '/api/table-methods#async-iterator-for-await-of'
                                },
                                { text: 'getHeaders()', link: '/api/table-methods#getheaders' },
                                { text: 'getHeaderCell()', link: '/api/table-methods#getheadercell' },
                                { text: 'scrollToColumn()', link: '/api/table-methods#scrolltocolumn' },
                                { text: 'reset()', link: '/api/table-methods#reset' },
                                { text: 'revalidate()', link: '/api/table-methods#revalidate' },
                                { text: 'sorting', link: '/api/table-methods#sorting' },
                                { text: 'generateConfig()', link: '/api/table-methods#generateconfig' },
                                { text: 'generateConfigPrompt()', link: '/api/table-methods#generateconfigprompt' }
                            ]
                        },
                        {
                            text: 'SmartRow',
                            link: '/api/smart-row',
                            collapsed: false,
                            items: [
                                { text: 'getCell()', link: '/api/smart-row#getcell' },
                                { text: 'toJSON()', link: '/api/smart-row#tojson' },
                                { text: 'bringIntoView()', link: '/api/smart-row#bringintoview' },
                                { text: 'smartFill()', link: '/api/smart-row#smartfill' },
                                { text: 'wasFound()', link: '/api/smart-row#wasfound' }
                            ]
                        },
                        {
                            text: 'SmartRowArray',
                            link: '/api/smart-row-array'
                        },
                        {
                            text: 'Strategies',
                            link: '/api/strategies',
                            collapsed: false,
                            items: [
                                { text: 'Pagination', link: '/api/strategies#pagination-strategies' },
                                { text: 'Sorting', link: '/api/strategies#sorting-strategies' },
                                { text: 'Fill', link: '/api/strategies#fill-strategy' },
                                { text: 'Header', link: '/api/strategies#header-strategy' },
                                { text: 'Cell locator', link: '/api/strategies#cell-locator-strategy' },
                                { text: 'Viewport', link: '/api/strategies#viewport-strategy' }
                            ]
                        }
                    ]
                }
            ],
            '/advanced/': [
                {
                    text: 'Advanced',
                    items: [
                        { text: 'Custom Resolution', link: '/advanced/custom-resolution' },
                        { text: 'TypeScript Tips', link: '/advanced/typescript' },
                        { text: 'Custom Strategies', link: '/advanced/custom-strategies' },
                        { text: 'Performance Tips', link: '/advanced/performance' },
                        { text: 'Preset Development', link: '/PRESET_DEVELOPMENT' },
                        { text: 'Preset Template', link: '/PRESET_TEMPLATE' }
                    ]
                }
            ],
            '/PRESET_DEVELOPMENT': presetSidebar,
            '/PRESET_TEMPLATE': presetSidebar,
            '/troubleshooting': [
                {
                    text: 'Help',
                    items: [
                        { text: 'Troubleshooting', link: '/troubleshooting' }
                    ]
                }
            ]
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/rickcedwhat/playwright-smart-table' }
        ],

        search: {
            provider: 'local'
        }
    }
})
