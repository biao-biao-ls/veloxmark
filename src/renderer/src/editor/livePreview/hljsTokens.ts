import hljs from 'highlight.js/lib/common'

/**
 * P29: highlight.js token ranges for the focused code-block panel.
 *
 * The rendered CodeBlockWidget (P24) and export already paint code with
 * hljs github/github-dark CSS scoped under `.theme-light`/`.theme-dark`.
 *
 * Color provenance (task 1C): hljs token COLORS are NOT in export/palette.ts.
 * They live upstream in `highlight.js/styles/github.css` / `github-dark.css`
 * (imported `?raw`) and are scoped at the consumer — `editor/widgets.ts`
 * (`injectScopedCss`, string-replaces `.hljs` under `.theme-light`/`.theme-dark`)
 * and `export/buildDocument.ts` (export stylesheet). This module only
 * produces the `hljs-*` CLASS vocabulary those sheets target; changing a
 * hljs color means patching the upstream sheet scope, not palette.ts.
 * The focused panel (P28) shows raw editor lines instead — to keep the
 * dual-state color contract, the decoration path highlights with the SAME
 * hljs vocabulary: these ranges become `Decoration.mark({ class })` where
 * class is an `.hljs-*` token class (never the bare `hljs` base class —
 * scoped CSS rewrites `.hljs { background }` onto any element that carries
 * it, which would paint a background box per token).
 *
 * Pure / DOM-less: safe to import from buildDecorations unit tests.
 */

export interface TokenRange {
  /** Inclusive start offset, relative to the highlighted code string. */
  from: number
  /** Exclusive end offset. */
  to: number
  /** Space-joined hljs token classes, e.g. `hljs-keyword`. */
  className: string
}

/** Soft cap: larger fences skip token marks to keep per-keystroke rebuilds cheap. */
export const HLJS_MAX_CONTENT = 32 * 1024

const CACHE_MAX = 4
const cache = new Map<string, TokenRange[]>()

/**
 * Token ranges for `code` under `lang`. Returns `[]` when the language is
 * unknown/empty, the content exceeds HLJS_MAX_CONTENT, or highlighting
 * throws — callers treat that as "panel without token colors".
 */
export function tokenRanges(code: string, lang: string): TokenRange[] {
  if (!lang || !code || code.length > HLJS_MAX_CONTENT) return []
  if (!hljs.getLanguage(lang)) return []
  const key = lang + '\0' + code
  const hit = cache.get(key)
  if (hit) return hit
  let html: string
  try {
    html = hljs.highlight(code, { language: lang }).value
  } catch {
    return [] // transient failures are not cached
  }
  const ranges = walkHljsHtml(html)
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, ranges)
  return ranges
}

/** Exposed for unit tests — walker is where mapping bugs would hide. */
export function walkHljsHtml(html: string): TokenRange[] {
  const ranges: TokenRange[] = []
  /** Stack of class lists from open <span class> tags; runs flatten the stack. */
  const stack: string[][] = []
  let pos = 0
  let i = 0

  const pushRun = (raw: string): void => {
    if (!raw) return
    const text = decodeEntities(raw)
    const len = text.length
    if (len > 0 && stack.some((c) => c.length > 0)) {
      const seen = new Set<string>()
      const classes: string[] = []
      for (const frame of stack) {
        for (const c of frame) {
          if (!seen.has(c)) {
            seen.add(c)
            classes.push(c)
          }
        }
      }
      ranges.push({ from: pos, to: pos + len, className: classes.join(' ') })
    }
    pos += len
  }

  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt === -1) {
      pushRun(html.slice(i))
      break
    }
    if (lt > i) pushRun(html.slice(i, lt))
    const gt = html.indexOf('>', lt)
    if (gt === -1) {
      // Malformed tail — treat as text so offsets stay consistent.
      pushRun(html.slice(lt))
      break
    }
    const tag = html.slice(lt + 1, gt)
    if (tag.startsWith('/')) {
      stack.pop()
    } else if (tag.startsWith('span')) {
      const m = /class="([^"]*)"/.exec(tag)
      stack.push(m ? m[1].split(/\s+/).filter(Boolean) : [])
    }
    // Any other tag: ignored (hljs emits only span); offset unaffected.
    i = gt + 1
  }

  // Merge adjacent same-class runs (hljs often splits one token into chunks).
  const merged: TokenRange[] = []
  for (const r of ranges) {
    const prev = merged[merged.length - 1]
    if (prev && prev.to === r.from && prev.className === r.className) prev.to = r.to
    else merged.push({ ...r })
  }
  return merged
}

/** Decode the HTML entities hljs emits so run lengths match document text. */
function decodeEntities(s: string): string {
  if (!s.includes('&')) return s
  return s.replace(
    /&(?:#x([0-9a-fA-F]+)|#(\d+)|(lt|gt|amp|quot|apos));/g,
    (_m, hex: string | undefined, dec: string | undefined, name: string | undefined) => {
      if (hex) return String.fromCodePoint(parseInt(hex, 16))
      if (dec) return String.fromCodePoint(parseInt(dec, 10))
      switch (name) {
        case 'lt':
          return '<'
        case 'gt':
          return '>'
        case 'amp':
          return '&'
        case 'quot':
          return '"'
        case 'apos':
          return "'"
      }
      return _m
    }
  )
}
