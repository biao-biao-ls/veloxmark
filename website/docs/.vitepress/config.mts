import { defineConfig } from 'vitepress'

const REPO = 'https://github.com/biao-biao-ls/veloxmark'

export default defineConfig({
  title: 'VeloxMark',
  description: 'A fast, focused Markdown editor with live preview — open source and cross-platform.',
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
          'A fast, focused Markdown editor with live preview — open source and cross-platform.'
      }
    ]
  ],
  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'VeloxMark',
    nav: [
      { text: 'Features', link: '/#features' },
      { text: 'Download', link: '/download' },
      { text: 'GitHub', link: REPO }
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
    }
  }
})
