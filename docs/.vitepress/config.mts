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
            '/guide/': [{
                text: 'Guide',
                items: [
                    { text: 'Getting Started', link: '/guide/start' },
                    { text: 'Describe Your Table', link: '/guide/describe' },
                    { text: 'Query Your Table', link: '/guide/query' },
                ]
            }],
            '/examples/': [{
                text: 'Examples',
                items: [
                    { text: 'Overview', link: '/examples/' },
                ]
            }],
            '/api/': [{
                text: 'API',
                items: [
                    { text: 'Reference', link: '/api/' },
                ]
            }],
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/rickcedwhat/playwright-smart-table' }
        ],

        search: {
            provider: 'local'
        }
    }
})
