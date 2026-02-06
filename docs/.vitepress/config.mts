import { defineConfig } from 'vitepress'

export default defineConfig({
    title: "Playwright Smart Table",
    description: "Production-ready table testing for Playwright",
    base: '/playwright-smart-table/',
    themeConfig: {
        nav: [
            { text: 'Guide', link: '/guide/getting-started' },
            { text: 'API', link: '/api/' },
            { text: 'Examples', link: '/examples/' },
            { text: 'Recipes', link: '/recipes/' },
            { text: 'Advanced', link: '/advanced/' },
            { text: 'Help', link: '/troubleshooting' }
        ],

        sidebar: {
            '/guide/': [
                {
                    text: 'Guide',
                    items: [
                        { text: 'Getting Started', link: '/guide/getting-started' },
                        { text: 'Core Concepts', link: '/guide/core-concepts' },
                        { text: 'Configuration', link: '/guide/configuration' }
                    ]
                }
            ],
            '/examples/': [
                {
                    text: 'Examples',
                    items: [
                        { text: 'Overview', link: '/examples/' },
                        { text: 'Basic Usage', link: '/examples/basic' },
                        { text: 'Pagination', link: '/examples/pagination' },
                        { text: 'Infinite Scroll', link: '/examples/infinite-scroll' },
                        { text: 'MUI DataGrid', link: '/examples/mui-datagrid' },
                        { text: 'AG Grid', link: '/examples/ag-grid' }
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
                                { text: 'headerSelector', link: '/api/table-config#headerselector' },
                                { text: 'rowSelector', link: '/api/table-config#rowselector' },
                                { text: 'cellSelector', link: '/api/table-config#cellselector' },
                                { text: 'headerTransformer', link: '/api/table-config#headertransformer' },
                                { text: 'strategies', link: '/api/table-config#strategies' },
                                { text: 'debug', link: '/api/table-config#debug' }
                            ]
                        },
                        {
                            text: 'Table Methods',
                            link: '/api/table-methods',
                            collapsed: false,
                            items: [
                                { text: 'init()', link: '/api/table-methods#init' },
                                { text: 'getRow()', link: '/api/table-methods#getrow' },
                                { text: 'getRows()', link: '/api/table-methods#getrows' },
                                { text: 'getRowByIndex()', link: '/api/table-methods#getrowbyindex' },
                                { text: 'findRow()', link: '/api/table-methods#findrow' },
                                { text: 'findRows()', link: '/api/table-methods#findrows' },
                                { text: 'getColumnValues()', link: '/api/table-methods#getcolumnvalues' },
                                { text: 'getHeaders()', link: '/api/table-methods#getheaders' },
                                { text: 'getHeaderCell()', link: '/api/table-methods#getheadercell' },
                                { text: 'iterateThroughTable()', link: '/api/table-methods#iteratethroughtable' },
                                { text: 'reset()', link: '/api/table-methods#reset' },
                                { text: 'sorting', link: '/api/table-methods#sorting' },
                                { text: 'generatePromptConfig()', link: '/api/table-methods#generatepromptconfig' }
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
                                { text: 'smartFill()', link: '/api/smart-row#smartfill' }
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
                                { text: 'Pagination', link: '/api/strategies#pagination' },
                                { text: 'Sorting', link: '/api/strategies#sorting' },
                                { text: 'Fill', link: '/api/strategies#fill' },
                                { text: 'Header', link: '/api/strategies#header' },
                                { text: 'Resolution', link: '/api/strategies#resolution' }
                            ]
                        }
                    ]
                }
            ],
            '/recipes/': [
                {
                    text: 'Recipes',
                    items: [
                        { text: 'Overview', link: '/recipes/' },
                        { text: 'Data Scraping', link: '/recipes/data-scraping' },
                        { text: 'Custom Strategies', link: '/recipes/custom-strategies' },
                        { text: 'Performance Tips', link: '/recipes/performance' }
                    ]
                }
            ],
            '/advanced/': [
                {
                    text: 'Advanced',
                    items: [
                        { text: 'Overview', link: '/advanced/' },
                        { text: 'Debugging', link: '/advanced/debugging' },
                        { text: 'Custom Resolution', link: '/advanced/custom-resolution' },
                        { text: 'TypeScript Tips', link: '/advanced/typescript' }
                    ]
                }
            ],
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
