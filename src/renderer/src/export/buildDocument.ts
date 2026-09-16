import katexCssRaw from 'katex/dist/katex.min.css?raw'
import hljsLightCss from 'highlight.js/styles/github.css?raw'
import hljsDarkCss from 'highlight.js/styles/github-dark.css?raw'
// 20 woff2 faces (~296 KB raw → ~400 KB base64). Vite's `?inline` turns each
// into a base64 data URL at build time, so the exported document carries them
// and needs no network. woff/ttf fallbacks in katex.min.css are stripped
// since woff2 covers every browser we target.
import fontAms from 'katex/dist/fonts/KaTeX_AMS-Regular.woff2?inline'
import fontCalBold from 'katex/dist/fonts/KaTeX_Caligraphic-Bold.woff2?inline'
import fontCalReg from 'katex/dist/fonts/KaTeX_Caligraphic-Regular.woff2?inline'
import fontFrakBold from 'katex/dist/fonts/KaTeX_Fraktur-Bold.woff2?inline'
import fontFrakReg from 'katex/dist/fonts/KaTeX_Fraktur-Regular.woff2?inline'
import fontMainBold from 'katex/dist/fonts/KaTeX_Main-Bold.woff2?inline'
import fontMainBoldItalic from 'katex/dist/fonts/KaTeX_Main-BoldItalic.woff2?inline'
import fontMainItalic from 'katex/dist/fonts/KaTeX_Main-Italic.woff2?inline'
import fontMainReg from 'katex/dist/fonts/KaTeX_Main-Regular.woff2?inline'
import fontMathBoldItalic from 'katex/dist/fonts/KaTeX_Math-BoldItalic.woff2?inline'
import fontMathItalic from 'katex/dist/fonts/KaTeX_Math-Italic.woff2?inline'
import fontSansBold from 'katex/dist/fonts/KaTeX_SansSerif-Bold.woff2?inline'
import fontSansItalic from 'katex/dist/fonts/KaTeX_SansSerif-Italic.woff2?inline'
import fontSansReg from 'katex/dist/fonts/KaTeX_SansSerif-Regular.woff2?inline'
import fontScript from 'katex/dist/fonts/KaTeX_Script-Regular.woff2?inline'
import fontSize1 from 'katex/dist/fonts/KaTeX_Size1-Regular.woff2?inline'
import fontSize2 from 'katex/dist/fonts/KaTeX_Size2-Regular.woff2?inline'
import fontSize3 from 'katex/dist/fonts/KaTeX_Size3-Regular.woff2?inline'
import fontSize4 from 'katex/dist/fonts/KaTeX_Size4-Regular.woff2?inline'
import fontTypewriter from 'katex/dist/fonts/KaTeX_Typewriter-Regular.woff2?inline'
import type { ThemeName } from '../editor/theme'
import { EXPORT_DOC_CSS } from './exportCss'
import { renderDoc, type ImageMode } from './renderDoc'

/**
 * Assemble a complete, self-contained HTML document from markdown (P04).
 *
 * Everything is inlined: export CSS, highlight.js theme, KaTeX CSS with its
 * woff2 fonts as data URLs (or a CDN <link> when the user opts out), and the
 * rendered body. No network needed to open the result — except the CDN mode.
 */

export type KatexFontMode = 'embed' | 'cdn'

export interface BuildDocumentOptions {
  title: string
  baseDir: string
  theme: ThemeName
  imageMode: ImageMode
  katexFonts: KatexFontMode
}

const KATEX_CDN_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css'

const KATEX_FONTS: Record<string, string> = {
  'KaTeX_AMS-Regular.woff2': fontAms,
  'KaTeX_Caligraphic-Bold.woff2': fontCalBold,
  'KaTeX_Caligraphic-Regular.woff2': fontCalReg,
  'KaTeX_Fraktur-Bold.woff2': fontFrakBold,
  'KaTeX_Fraktur-Regular.woff2': fontFrakReg,
  'KaTeX_Main-Bold.woff2': fontMainBold,
  'KaTeX_Main-BoldItalic.woff2': fontMainBoldItalic,
  'KaTeX_Main-Italic.woff2': fontMainItalic,
  'KaTeX_Main-Regular.woff2': fontMainReg,
  'KaTeX_Math-BoldItalic.woff2': fontMathBoldItalic,
  'KaTeX_Math-Italic.woff2': fontMathItalic,
  'KaTeX_SansSerif-Bold.woff2': fontSansBold,
  'KaTeX_SansSerif-Italic.woff2': fontSansItalic,
  'KaTeX_SansSerif-Regular.woff2': fontSansReg,
  'KaTeX_Script-Regular.woff2': fontScript,
  'KaTeX_Size1-Regular.woff2': fontSize1,
  'KaTeX_Size2-Regular.woff2': fontSize2,
  'KaTeX_Size3-Regular.woff2': fontSize3,
  'KaTeX_Size4-Regular.woff2': fontSize4,
  'KaTeX_Typewriter-Regular.woff2': fontTypewriter
}

function inlineKatexCss(): string {
  let css = katexCssRaw
  // Drop woff/ttf fallbacks — woff2 first-in-src is universally supported.
  css = css.replace(/,\s*url\(fonts\/[^)]+\.(woff|ttf)\)\s*format\("(woff|truetype)"\)/g, '')
  for (const [file, dataUrl] of Object.entries(KATEX_FONTS)) {
    css = css.replaceAll(`url(fonts/${file})`, `url(${dataUrl})`)
  }
  return css
}

/** Highlight.js theme scoped under the export theme class (parity with widgets.ts). */
function scopedHljsCss(theme: ThemeName): string {
  const scope = theme === 'dark' ? '.export-theme-dark' : '.export-theme-light'
  return (theme === 'dark' ? hljsDarkCss : hljsLightCss).replaceAll('.hljs', `${scope} .hljs`)
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function buildExportHtml(
  markdown: string,
  opts: BuildDocumentOptions
): Promise<string> {
  const body = await renderDoc(markdown, {
    baseDir: opts.baseDir,
    theme: opts.theme,
    imageMode: opts.imageMode
  })

  const styles: string[] = [EXPORT_DOC_CSS, scopedHljsCss(opts.theme)]
  const links: string[] = []
  if (opts.katexFonts === 'embed') {
    styles.push(inlineKatexCss())
  } else {
    links.push(`<link rel="stylesheet" href="${KATEX_CDN_URL}">`)
  }

  const themeClass = opts.theme === 'dark' ? 'export-theme-dark' : 'export-theme-light'
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtmlText(opts.title)}</title>
${links.join('\n')}
<style>
${styles.join('\n')}
</style>
</head>
<body>
<article class="export-doc ${themeClass}">
${body}
</article>
</body>
</html>`
}
