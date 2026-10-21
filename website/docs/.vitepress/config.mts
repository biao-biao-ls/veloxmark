import { defineConfig, type HeadConfig } from 'vitepress'
import { writeFileSync, readFileSync, statSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { EN, type WebsiteLocaleStrings } from './locales/en'
import { ZH } from './locales/zh'
import { JA } from './locales/ja'
import { KO } from './locales/ko'
import { ES } from './locales/es'
import { PT } from './locales/pt'
import { FR } from './locales/fr'
import { DE } from './locales/de'
import { RU } from './locales/ru'

const REPO = 'https://github.com/biao-biao-ls/veloxmark'
const SITE_URL = 'https://veloxmark.knzn.net'
const VERSION = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')
).version as string

/** All locales. `prefix` is the URL directory ('' for the root locale). */
const LOCALES: Array<{ pack: WebsiteLocaleStrings; prefix: string }> = [
  { pack: EN, prefix: '' },
  { pack: ZH, prefix: 'zh/' },
  { pack: JA, prefix: 'ja/' },
  { pack: KO, prefix: 'ko/' },
  { pack: ES, prefix: 'es/' },
  { pack: PT, prefix: 'pt/' },
  { pack: FR, prefix: 'fr/' },
  { pack: DE, prefix: 'de/' },
  { pack: RU, prefix: 'ru/' }
]

/** cleanUrls path for a markdown page relative to the content root. */
function pageUrl(relativePath: string): string {
  let p = relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
  if (p === '') return `${SITE_URL}/`
  return `${SITE_URL}/${p}`.replace(/\/$/, p.endsWith('/') ? '/' : '')
}

/** Path with any locale prefix stripped — the key shared across locales. */
function logicalPath(relativePath: string): string {
  for (const { prefix } of LOCALES) {
    if (prefix && relativePath.startsWith(prefix)) return relativePath.slice(prefix.length)
  }
  return relativePath
}

function localeOf(relativePath: string): { pack: WebsiteLocaleStrings; prefix: string } {
  return (
    LOCALES.find(({ prefix }) => prefix && relativePath.startsWith(prefix)) ?? LOCALES[0]
  )
}

/** hreflang alternates for a page: every locale's URL + x-default (root locale). */
function alternates(relativePath: string): Array<{ hreflang: string; href: string }> {
  const logical = logicalPath(relativePath)
  return [
    ...LOCALES.map((l) => ({
      hreflang: l.pack.hreflang,
      href: pageUrl(l.prefix + logical)
    })),
    { hreflang: 'x-default', href: pageUrl(logical) }
  ]
}

/** ISO date of a source file's last modification, for sitemap lastmod. */
function lastmod(srcDir: string, relativePath: string): string {
  try {
    return statSync(join(srcDir, relativePath)).mtime.toISOString().slice(0, 10)
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function softwareGraph(pack: WebsiteLocaleStrings) {
  return {
    '@type': 'SoftwareApplication',
    name: 'VeloxMark',
    alternateName: 'VeloxMark Markdown editor',
    url: `${SITE_URL}/`,
    inLanguage: pack.lang,
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Text editor',
    operatingSystem: 'macOS, Windows, Linux',
    description: pack.schemaDescription,
    softwareVersion: VERSION,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    downloadUrl: `${REPO}/releases/latest`,
    license: 'https://opensource.org/licenses/MIT',
    softwareHelp: {
      '@type': 'CreativeWork',
      url: pageUrl(pack.prefix + 'docs/index.md')
    },
    featureList: pack.schemaFeatures,
    screenshot: `${SITE_URL}/img/hero-light.png`
  }
}

/** Site-wide JSON-LD graph for one locale (Organization + WebSite + SoftwareApplication). */
function siteGraph(pack: WebsiteLocaleStrings): string {
  return JSON.stringify({
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
        url: pageUrl(pack.prefix + 'index.md'),
        inLanguage: pack.lang,
        publisher: { '@id': `${SITE_URL}/#organization` }
      },
      softwareGraph(pack)
    ]
  })
}

/** Per-locale VitePress locale config derived from the packs. */
const localeConfigs = Object.fromEntries(
  LOCALES.map(({ pack, prefix }, i) => [
    i === 0 ? 'root' : prefix.replace(/\/$/, ''),
    {
      label: pack.label,
      lang: pack.lang,
      link: pack.link,
      title: 'VeloxMark',
      description: pack.description,
      themeConfig: {
        nav: pack.nav,
        editLink: {
          pattern: `${REPO}/edit/main/website/docs/:path`,
          text: pack.editLinkText
        },
        footer: {
          message: pack.footerMessage,
          copyright: 'Copyright © 2026 VeloxMark contributors'
        },
        outline: { level: [2, 3], label: pack.outlineLabel },
        docFooter: { prev: pack.docPrev, next: pack.docNext },
        sidebar: { [`/${prefix}docs/`]: pack.sidebar }
      }
    }
  ])
)

export default defineConfig({
  title: 'VeloxMark',
  description: EN.description,
  lang: EN.lang,
  cleanUrls: true,
  locales: localeConfigs,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#1c2f52' }],
    // Locale-agnostic Open Graph / Twitter defaults
    ['meta', { property: 'og:site_name', content: 'VeloxMark' }],
    ['meta', { property: 'og:image', content: `${SITE_URL}/img/og-card.png` }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    [
      'meta',
      {
        property: 'og:image:alt',
        content: 'VeloxMark — write in Markdown, everything else is decoration'
      }
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${SITE_URL}/img/og-card.png` }]
  ],
  transformHead: ({ pageData, title, description }) => {
    const head: HeadConfig[] = []
    const rel = pageData.relativePath
    const { pack } = localeOf(rel)
    const logical = logicalPath(rel)
    const isHome = logical === 'index.md'
    const isDocs = logical.startsWith('docs/') && !isHome
    const url = pageUrl(rel)
    const fm = pageData.frontmatter ?? {}

    // Self-referencing canonical + hreflang alternates
    head.push(['link', { rel: 'canonical', href: url }])
    for (const alt of alternates(rel)) {
      head.push(['link', { rel: 'alternate', hreflang: alt.hreflang, href: alt.href }])
    }

    // Open Graph / Twitter per page
    head.push(['meta', { property: 'og:url', content: url }])
    head.push(['meta', { property: 'og:locale', content: pack.ogLocale }])
    for (const other of LOCALES) {
      if (other.pack.ogLocale !== pack.ogLocale) {
        head.push(['meta', { property: 'og:locale:alternate', content: other.pack.ogLocale }])
      }
    }
    if (isHome) {
      head.push(['meta', { property: 'og:title', content: pack.homeOgTitle }])
      head.push(['meta', { property: 'og:description', content: pack.description }])
      head.push(['meta', { property: 'og:type', content: 'website' }])
      head.push(['meta', { name: 'twitter:title', content: pack.homeOgTitle }])
      head.push(['meta', { name: 'twitter:description', content: pack.description }])
    } else {
      // `title` already carries the full document title (e.g. "FAQ | VeloxMark")
      head.push(['meta', { property: 'og:title', content: title }])
      if (description) head.push(['meta', { property: 'og:description', content: description }])
      head.push(['meta', { property: 'og:type', content: 'article' }])
      head.push(['meta', { name: 'twitter:title', content: title }])
      if (description) head.push(['meta', { name: 'twitter:description', content: description }])
    }

    // Page keywords (frontmatter keywords: [..])
    const keywords = fm.keywords
    if (Array.isArray(keywords) && keywords.length > 0) {
      head.push(['meta', { name: 'keywords', content: keywords.join(', ') }])
    }

    // Site-wide JSON-LD graph (localized)
    head.push(['script', { type: 'application/ld+json' }, siteGraph(pack)])

    // BreadcrumbList for docs pages — Home / Docs / Page
    if (isDocs) {
      const label = typeof fm.title === 'string' ? fm.title : title
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: pack.breadcrumbHome,
              item: pageUrl(pack.prefix + 'index.md')
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: pack.breadcrumbDocs,
              item: pageUrl(pack.prefix + 'docs/index.md')
            },
            { '@type': 'ListItem', position: 3, name: label, item: url }
          ]
        })
      ])
    }

    return head
  },
  buildEnd: (siteConfig) => {
    const { outDir, srcDir, pages } = siteConfig

    // --- sitemap.xml with hreflang alternates ---
    const urls = pages
      .map((p) => {
        const loc = pageUrl(p)
        const altLines = alternates(p)
          .map(
            (a) =>
              `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`
          )
          .join('\n')
        const priority =
          loc.endsWith('/docs/') || loc.endsWith('/docs')
            ? '0.8'
            : loc === `${SITE_URL}/` || localeOf(p).prefix !== '' && logicalPath(p) === 'index.md'
              ? '1.0'
              : '0.6'
        return `  <url>\n    <loc>${loc}</loc>\n${altLines}\n    <lastmod>${lastmod(srcDir, p)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`
      })
      .join('\n')
    writeFileSync(
      join(outDir, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`
    )

    // --- llms.txt + llms-full.txt per locale ---
    for (const { pack, prefix } of LOCALES) {
      const localePages = pages.filter((p) => p.startsWith(prefix) && !p.includes('404'))
      writeFileSync(join(outDir, prefix, 'llms.txt'), pack.llmsTxt)
      const parts: string[] = [
        `# VeloxMark — full documentation (${pack.lang})\n`,
        `> Source: ${SITE_URL}${prefix ? `/${prefix}` : '/'} — a free, open-source Markdown editor with live preview.\n`
      ]
      for (const p of localePages) {
        const raw = readFileSync(join(srcDir, p), 'utf8')
        const fmTitle = raw.match(/^title:\s*(.+)$/m)?.[1]?.trim()
        const body = raw.replace(/^---[\s\S]*?---\n/, '')
        const heading = body.match(/^#\s+(.+)$/m)?.[1] ?? fmTitle ?? 'VeloxMark'
        parts.push(`\n\n---\n\n# ${heading}\n\nSource: ${pageUrl(p)}\n\n${body.trim()}`)
      }
      const fullDir = join(outDir, prefix)
      mkdirSync(fullDir, { recursive: true })
      writeFileSync(join(fullDir, 'llms-full.txt'), parts.join(''))
    }
    console.log(
      `\n  ✓ sitemap.xml + llms.txt + llms-full.txt written (${pages.length} pages, ${LOCALES.length} locales)`
    )
  },
  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'VeloxMark',
    socialLinks: [{ icon: 'github', link: REPO }],
    search: {
      provider: 'local'
    }
  }
})
