import { defineConfig } from 'vitepress'

export default defineConfig({
    title: "Playwright Smart Table",
    description: "Production-ready table testing for Playwright",
    themeConfig: {
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Guide', link: '/guide/getting-started' },
            { text: 'API', link: '/api/' }
        ],

        sidebar: [
            {
                text: 'Introduction',
                items: [
                    { text: 'Getting Started', link: '/guide/getting-started' },
                    { text: 'Core Concepts', link: '/guide/core-concepts' },
                ]
            },
            {
                text: 'Guides',
                items: [
                    { text: 'Strategies', link: '/guide/strategies' },
                    { text: 'Debugging', link: '/guide/debugging' },
                    { text: 'Recipe Book', link: '/guide/recipes' }
                ]
            },
            {
                text: 'Reference',
                items: [
                    { text: 'API Reference', link: '/api/' }
                ]
            }
        ],

        socialLinks: [
            { icon: 'github', link: 'https://github.com/rickcedwhat/playwright-smart-table' }
        ]
    }
})
