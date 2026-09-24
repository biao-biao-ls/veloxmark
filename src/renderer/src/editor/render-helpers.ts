import hljs from 'highlight.js/lib/common'
import katex from 'katex'

// ---- shared render helpers (P04 export reuses these for static DOM) --------
// (2.2: pure helpers moved verbatim from editor/widgets.ts — zero state;
// consumed by codeBlock-widget / widgets-math and export/renderDoc.)

/**
 * Highlight `code` with highlight.js for `lang`; returns the innerHTML for a
 * `<code class="hljs">` element. Falls back to plain escaped text when the
 * language is unknown or highlighting throws.
 */
export function highlightCodeHtml(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang }).value
    } catch {
      // fall through to plain text
    }
  }
  const el = document.createElement('code')
  el.textContent = code
  return el.innerHTML
}

/** Render TeX to an HTML string (KaTeX); falls back to the raw source. */
export function renderKatexHtml(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false })
  } catch {
    const el = document.createElement(displayMode ? 'div' : 'span')
    el.textContent = tex
    return el.outerHTML
  }
}

/**
 * 8C: checked variant — `ok` probes KaTeX with `throwOnError: true`; `html` is
 * ALWAYS the same `renderKatexHtml` output (valid TeX renders byte-identical to
 * the pre-8C widgets — the probe never changes the render surface).
 */
export function renderKatexChecked(
  tex: string,
  displayMode: boolean
): { ok: boolean; html: string } {
  let ok = true
  try {
    katex.renderToString(tex, { displayMode, throwOnError: true })
  } catch {
    ok = false
  }
  return { ok, html: renderKatexHtml(tex, displayMode) }
}

/**
 * P24: span-aware highlighted-line splitter. hljs output wraps tokens in
 * <span>s that may cross line breaks; splitting on '\n' alone would leave
 * unbalanced tags and wreck the line-number layout. Close every open span at
 * a newline and reopen the active tag stack on the next line.
 */
export function splitHighlightedLines(html: string): string[] {
  const lines: string[] = []
  const stack: string[] = []
  let cur = ''
  let i = 0
  while (i < html.length) {
    const ch = html[i]
    if (ch === '<') {
      const end = html.indexOf('>', i)
      if (end === -1) {
        cur += html.slice(i)
        break
      }
      const tag = html.slice(i, end + 1)
      if (tag.startsWith('</')) stack.pop()
      else if (!tag.endsWith('/>')) stack.push(tag)
      cur += tag
      i = end + 1
    } else if (ch === '\n') {
      for (let k = 0; k < stack.length; k++) cur += '</span>'
      lines.push(cur)
      cur = stack.join('')
      i += 1
    } else {
      const nextNl = html.indexOf('\n', i)
      const nextTag = html.indexOf('<', i)
      let stop = html.length
      if (nextTag !== -1) stop = Math.min(stop, nextTag)
      if (nextNl !== -1) stop = Math.min(stop, nextNl)
      cur += html.slice(i, stop)
      i = stop
    }
  }
  lines.push(cur)
  return lines
}
