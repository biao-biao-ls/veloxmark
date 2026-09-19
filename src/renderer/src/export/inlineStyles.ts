import { paletteFor, type Palette } from './palette'

/**
 * P20 rich-text clipboard styling.
 *
 * WeChat / Feishu / mail composers strip class names and <style> blocks —
 * only inline `style=` attributes survive. The tag→style map below mirrors
 * the class-based rules in exportCss.ts using the shared palette tokens;
 * `inlineStyleFragment` (renderer-only, DOMParser) walks a renderDoc
 * fragment and stamps the styles onto each element.
 *
 * Unit tests (node) cover the pure style-map builders; the DOM walk itself
 * is exercised by scripts/cdp-p20.mjs.
 */

const MONO = `"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace`
const SANS = `'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif`

/** Tag-level styles for one palette (pure; node-testable). */
export function tagStyles(p: Palette): Record<string, string> {
  return {
    h1: `font-size:2em;font-weight:650;margin:0.67em 0;color:${p.fg};font-family:${SANS}`,
    h2: `font-size:1.5em;font-weight:650;margin:0.83em 0;color:${p.fg};font-family:${SANS}`,
    h3: `font-size:1.25em;font-weight:650;margin:1em 0;color:${p.fg};font-family:${SANS}`,
    h4: `font-size:1.05em;font-weight:650;margin:1.33em 0;color:${p.fg};font-family:${SANS}`,
    h5: `font-size:1em;font-weight:650;margin:1.5em 0;color:${p.fg};font-family:${SANS}`,
    h6: `font-size:0.9em;font-weight:650;margin:1.67em 0;color:${p.fgDim};font-family:${SANS}`,
    p: `margin:0.75em 0;color:${p.fg};font-family:${SANS};font-size:16px;line-height:1.6`,
    strong: `font-weight:700`,
    b: `font-weight:700`,
    em: `font-style:italic`,
    i: `font-style:italic`,
    del: `text-decoration:line-through;color:${p.fgDim}`,
    s: `text-decoration:line-through;color:${p.fgDim}`,
    code: `font-family:${MONO};font-size:0.9em;background:${p.codeBg};padding:0.15em 0.35em;border-radius:4px`,
    pre: `background:${p.bgAlt};border:1px solid ${p.border};border-radius:8px;padding:12px 14px;overflow:auto;margin:0.75em 0;font-family:${MONO};font-size:0.9em;line-height:1.5`,
    blockquote: `margin:0.75em 0;padding:0.25em 0 0.25em 14px;border-left:4px solid ${p.quoteBorder};color:${p.fgDim}`,
    a: `color:${p.accent};text-decoration:underline`,
    hr: `border:none;border-top:1px solid ${p.hrColor};margin:1.2em 0`,
    ul: `margin:0.75em 0;padding-left:1.6em;color:${p.fg};font-family:${SANS}`,
    ol: `margin:0.75em 0;padding-left:1.6em;color:${p.fg};font-family:${SANS}`,
    li: `margin:0.25em 0;color:${p.fg};font-family:${SANS};font-size:16px;line-height:1.6`,
    table: `border-collapse:collapse;margin:0.75em 0;font-family:${SANS};font-size:15px;color:${p.fg}`,
    th: `border:1px solid ${p.border};padding:6px 10px;background:${p.bgAlt};font-weight:650;text-align:left`,
    td: `border:1px solid ${p.border};padding:6px 10px`,
    mark: `background:${p.highlightBg};color:inherit;padding:0 0.15em`,
    sup: `font-size:0.75em;vertical-align:super`,
    sub: `font-size:0.75em;vertical-align:sub`,
    abbr: `text-decoration:underline dotted;border-bottom:none`
  }
}

/** Class-level styles (renderDoc helpers) for one palette (pure). */
export function classStyles(p: Palette): Record<string, string> {
  return {
    'export-code': `margin:0.75em 0`,
    'export-code-lang': `font-family:${MONO};font-size:12px;color:${p.fgDim};margin-bottom:4px`,
    'export-mermaid': `margin:0.75em 0;text-align:center`,
    'export-mermaid-error': `color:#d1242f;font-family:${MONO};font-size:13px;text-align:left`,
    'export-math-block': `margin:0.75em 0;overflow-x:auto`,
    'export-math-inline': ``,
    'export-mark': `background:${p.highlightBg};color:inherit;padding:0 0.15em`,
    'export-footnote-ref': `font-size:0.75em`,
    'export-footnotes-sep': `border:none;border-top:1px solid ${p.hrColor};margin:1.2em 0`,
    'export-footnotes': `color:${p.fgDim};font-size:0.9em;padding-left:1.4em`,
    'export-dl': `margin:0.75em 0;color:${p.fg}`,
    'export-fm-title': `font-size:2em;font-weight:650;margin:0.67em 0;color:${p.fg}`
  }
}

function mergeStyle(el: Element, css: string): void {
  if (!css) return
  const prev = el.getAttribute('style')
  el.setAttribute('style', prev ? `${prev};${css}` : css)
}

/**
 * Stamp inline styles onto a parsed fragment body. Renderer-only
 * (DOMParser); returns the serialized inner HTML.
 */
export function inlineStyleFragment(fragmentHtml: string, theme: 'light' | 'dark'): string {
  const p = paletteFor(theme)
  const doc = new DOMParser().parseFromString(`<body>${fragmentHtml}</body>`, 'text/html')
  const body = doc.body
  const tags = tagStyles(p)
  for (const [tag, css] of Object.entries(tags)) {
    for (const el of body.querySelectorAll(tag)) mergeStyle(el, css)
  }
  const classes = classStyles(p)
  for (const [cls, css] of Object.entries(classes)) {
    for (const el of body.querySelectorAll('.' + cls)) mergeStyle(el, css)
  }
  // Nested `pre code` shouldn't re-paint the block background on the inline rule.
  for (const code of body.querySelectorAll('pre code')) {
    code.setAttribute(
      'style',
      `font-family:${MONO};font-size:0.9em;background:transparent;padding:0;border-radius:0;color:inherit`
    )
  }
  // Zebra rows — exportCss uses tr:nth-child(even); inline walk instead.
  for (const table of body.querySelectorAll('table')) {
    const rows = table.querySelectorAll('tr')
    rows.forEach((tr, i) => {
      if (i > 0 && i % 2 === 1) {
        for (const cell of tr.children) mergeStyle(cell, `background:${p.bgAlt}`)
      }
    })
  }
  return body.innerHTML
}

/**
 * Wrapper div carrying document-level context styles (bg/fg/font) so a paste
 * target that strips <html>/<body> still reads the theme.
 */
export function wrapFragment(fragmentHtml: string, theme: 'light' | 'dark'): string {
  const p = paletteFor(theme)
  return (
    `<div style="background:${p.bg};color:${p.fg};font-family:${SANS};` +
    `font-size:16px;line-height:1.6;padding:12px;box-sizing:border-box;">` +
    fragmentHtml +
    `</div>`
  )
}
