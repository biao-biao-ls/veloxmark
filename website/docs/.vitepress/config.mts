import { defineConfig } from 'vitepress'

const REPO = 'https://github.com/biao-biao-ls/veloxmark'

export default defineConfig({
  title: 'VeloxMark',
  description:
    'A free, open-source Markdown editor with live preview for macOS, Windows and Linux. Typora-style editing, KaTeX math, Mermaid diagrams, native tables — all rendered live.',
  lang: 'en-US',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#1c2f52' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'VeloxMark' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'A free, open-source Markdown editor with live preview for macOS, Windows and Linux. Typora-style editing, KaTeX math, Mermaid diagrams, native tables — all rendered live.'
      }
    ],
    ['meta', { property: 'og:image', content: '/logo.png' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    [
      'script',
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'VeloxMark',
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'macOS, Windows, Linux',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          downloadUrl: `${REPO}/releases/latest`,
          license: 'https://opensource.org/licenses/MIT'
        })
      }
    ]
  ],
  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'VeloxMark',
    nav: [
      { text: 'Features', link: '/#preview' },
      { text: 'Markdown', link: '/#extensions' },
      { text: 'Docs', link: '/docs/' },
      { text: 'Download', link: '/download' }
    ],
    socialLinks: [{ icon: 'github', link: REPO }],
    editLink: {
      pattern: `${REPO}/edit/main/website/docs/:path`,
      text: 'Edit this page on GitHub'
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 VeloxMark contributors'
    },
    search: {
      provider: 'local'
    },
    outline: { level: [2, 3], label: 'On this page' },
    docFooter: { prev: 'Previous', next: 'Next' },
    sidebar: {
      '/docs/': [
        {
          text: 'Quick start',
          items: [
            { text: 'Introduction', link: '/docs/' },
            { text: 'Installation', link: '/docs/installation' },
            { text: 'Basics', link: '/docs/basics' },
            { text: 'Editing in depth', link: '/docs/editing' },
            { text: 'Markdown syntax', link: '/docs/markdown-syntax' }
          ]
        },
        {
          text: 'Configuration',
          items: [
            { text: 'Preferences', link: '/docs/preferences' },
            { text: 'Key bindings', link: '/docs/key-bindings' },
            { text: 'Language & localization', link: '/docs/language' }
          ]
        },
        {
          text: 'Export & themes',
          items: [
            { text: 'Export a document', link: '/docs/export' },
            { text: 'Themes', link: '/docs/themes' },
            { text: 'Images', link: '/docs/images' }
          ]
        },
        {
          text: 'More',
          items: [
            { text: 'Auto-update', link: '/docs/updates' },
            { text: 'FAQ', link: '/docs/faq' }
          ]
        }
      ]
    }
  }
})
