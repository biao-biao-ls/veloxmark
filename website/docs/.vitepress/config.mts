import { defineConfig, type HeadConfig } from 'vitepress'
import { writeFileSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const REPO = 'https://github.com/biao-biao-ls/veloxmark'
const SITE_URL = 'https://veloxmark.knzn.net'
const VERSION = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
).version as string

/** cleanUrls path for a markdown page relative to the content root. */
function pageUrl(relativePath: string): string {
  let p = relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
  if (p === '') return `${SITE_URL}/`
  return `${SITE_URL}/${p}`.replace(/\/$/, p.endsWith('/') ? '/' : '')
}

/** ISO date of a source file's last modification, for sitemap lastmod. */
function lastmod(srcDir: string, relativePath: string): string {
  try {
    return statSync(join(srcDir, relativePath)).mtime.toISOString().slice(0, 10)
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

const SOFTWARE_GRAPH = {
  '@type': 'SoftwareApplication',
  name: 'VeloxMark',
  alternateName: 'VeloxMark Markdown editor',
  url: `${SITE_URL}/`,
  applicationCategory: 'DeveloperApplication',
  applicationSubCategory: 'Text editor',
  operatingSystem: 'macOS, Windows, Linux',
  description:
    'A free, open-source Markdown editor with live preview for macOS, Windows and Linux. Markdown source is the only data source — saving writes plain .md with zero round-trip loss. KaTeX math, Mermaid diagrams, native table editing, callouts, footnotes and highlights, all rendered live.',
  softwareVersion: VERSION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  downloadUrl: `${REPO}/releases/latest`,
  license: 'https://opensource.org/licenses/MIT',
  softwareHelp: { '@type': 'CreativeWork', url: `${SITE_URL}/docs/` },
  featureList: [
    'Live preview editing (Typora-style, in place)',
    'KaTeX math and Mermaid diagrams rendered live',
    'Native table editing with nested cell editors',
    'Focus mode, typewriter mode, light and dark themes',
    'PDF and HTML export',
    'Plain Markdown files with zero round-trip loss',
    'Nine UI languages'
  ],
  screenshot: `${SITE_URL}/img/hero-light.png`
}

export default defineConfig({
  title: 'VeloxMark',
  description:
    'A free, open-source Markdown editor with live preview for macOS, Windows and Linux. KaTeX math, Mermaid diagrams and native tables — all rendered live.',
  lang: 'en-US',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#1c2f52' }],
    ['meta', { name: 'keywords', content: 'markdown editor, live preview, open source, WYSIWYG, KaTeX, Mermaid, Typora alternative, Electron, CodeMirror' }],
    // Open Graph / Twitter — absolute URLs so link unfurlers can resolve them
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'VeloxMark' }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    ['meta', { property: 'og:title', content: 'VeloxMark — a Markdown editor with live preview' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'A free, open-source Markdown editor with live preview for macOS, Windows and Linux. KaTeX math, Mermaid diagrams and native tables — all rendered live.'
      }
    ],
    ['meta', { property: 'og:url', content: `${SITE_URL}/` }],
    ['meta', { property: 'og:image', content: `${SITE_URL}/img/og-card.png` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: 'VeloxMark — write in Markdown, everything else is decoration' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'VeloxMark — a Markdown editor with live preview' }],
    [
      'meta',
      {
        name: 'twitter:description',
        content:
          'A free, open-source Markdown editor with live preview for macOS, Windows and Linux. KaTeX math, Mermaid diagrams and native tables — all rendered live.'
      }
    ],
    ['meta', { name: 'twitter:image', content: `${SITE_URL}/img/og-card.png` }],
    // Structured data: Organization + WebSite + SoftwareApplication as one graph
    // NOTE: VitePress renders the third tuple element as script content; an
    // `innerHTML:` key would be serialized as a plain attribute instead.
    [
      'script',
      { type: 'application/ld+json' },
      JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            name: 'VeloxMark',
            url: `${SITE_URL}/`,
            logo: `${SITE_URL}/logo.png`,
            sameAs: [REPO]
          },
          {
            '@type': 'WebSite',
            name: 'VeloxMark',
            url: `${SITE_URL}/`,
            inLanguage: 'en',
            publisher: { '@id': `${SITE_URL}/#organization` }
          },
          SOFTWARE_GRAPH
        ]
      })
    ]
  ],
  transformHead: ({ pageData, title, description }) => {
    const head: HeadConfig[] = []
    const url = pageUrl(pageData.relativePath)
    const fm = pageData.frontmatter ?? {}
    const isHome = pageData.relativePath === 'index.md'

    // Per-page canonical + Open Graph (the global head sets site-level defaults)
    head.push(['link', { rel: 'canonical', href: url }])
    head.push(['meta', { property: 'og:url', content: url }])
    if (!isHome) {
      // `title` already carries the full document title (e.g. "FAQ | VeloxMark")
      head.push(['meta', { property: 'og:title', content: title }])
      if (description) head.push(['meta', { property: 'og:description', content: description }])
      head.push(['meta', { property: 'og:type', content: 'article' }])
    }

    // Page keywords (frontmatter keywords: [..])
    const keywords = fm.keywords
    if (Array.isArray(keywords) && keywords.length > 0) {
      head.push(['meta', { name: 'keywords', content: keywords.join(', ') }])
    }

    // BreadcrumbList for docs pages — Home / Docs / Page
    if (pageData.relativePath.startsWith('docs/') && !isHome) {
      const label = typeof fm.title === 'string' ? fm.title : title
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Docs', item: `${SITE_URL}/docs/` },
            { '@type': 'ListItem', position: 3, name: label, item: url }
          ]
        })
      ])
    }

    return head
  },
  buildEnd: (siteConfig) => {
    const { outDir, srcDir, pages } = siteConfig
    const urls = pages
      .map((p) => {
        const loc = pageUrl(p)
        return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod(srcDir, p)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${loc === `${SITE_URL}/` ? '1.0' : loc === `${SITE_URL}/docs/` ? '0.8' : '0.6'}</priority>\n  </url>`
      })
      .join('\n')
    writeFileSync(
      join(outDir, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
    )

    // llms-full.txt — complete documentation content for LLM ingestion
    const parts: string[] = [
      '# VeloxMark — full documentation\n',
      `> ${SITE_URL === 'https://veloxmark.knzn.net' ? 'Source: ' + SITE_URL : SITE_URL} — a free, open-source Markdown editor with live preview.\n`
    ]
    for (const p of pages) {
      const raw = readFileSync(join(srcDir, p), 'utf8')
      const fmTitle = raw.match(/^title:\s*(.+)$/m)?.[1]?.trim()
      const body = raw.replace(/^---[\s\S]*?---\n/, '')
      const heading = body.match(/^#\s+(.+)$/m)?.[1] ?? fmTitle ?? 'VeloxMark home'
      parts.push(`\n\n---\n\n# ${heading}\n\nSource: ${pageUrl(p)}\n\n${body.trim()}`)
    }
    writeFileSync(join(outDir, 'llms-full.txt'), parts.join(''))
    console.log(`\n  ✓ sitemap.xml and llms-full.txt written (${pages.length} pages)`)
  },
  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'VeloxMark',
    nav: [
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
          text: 'Getting started',
          items: [
            { text: 'Introduction', link: '/docs/' },
            { text: 'Installation', link: '/docs/installation' },
            { text: 'Basics', link: '/docs/basics' }
          ]
        },
        {
          text: 'Writing',
          items: [
            { text: 'Editing in depth', link: '/docs/editing' },
            { text: 'Markdown syntax', link: '/docs/markdown-syntax' },
            { text: 'Images', link: '/docs/images' }
          ]
        },
        {
          text: 'Reference',
          items: [
            { text: 'Preferences', link: '/docs/preferences' },
            { text: 'Key bindings', link: '/docs/key-bindings' },
            { text: 'Language & localization', link: '/docs/language' },
            { text: 'Export a document', link: '/docs/export' },
            { text: 'Themes', link: '/docs/themes' }
          ]
        },
        {
          text: 'Help',
          items: [
            { text: 'Auto-update', link: '/docs/updates' },
            { text: 'FAQ', link: '/docs/faq' }
          ]
        }
      ]
    }
  }
})
