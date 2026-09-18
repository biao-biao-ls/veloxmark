/**
 * P11 extended syntax — pure parsers.
 *
 * No CodeMirror / DOM imports so P15 vitest can run these in node. The
 * decoration collector lives in livePreview/handlers.ts (`collectExtendedDecos`,
 * alongside the math regex pass); widgets live in editor/widgets.ts.
 */

export interface FrontMatterSummary {
  title?: string
  date?: string
  tags?: string[]
  /** All keys in appearance order (card shows the summary rows). */
  keys: string[]
}

export interface FrontMatterResult {
  /** Raw YAML between the fences (without the `---` lines). */
  yaml: string
  /**
   * Exclusive end offset of the match — covers the closing `---` line and
   * its trailing newline when one exists, so replacing [0, end) with the
   * card leaves the body's own blank separator untouched.
   */
  end: number
  summary: FrontMatterSummary
}

/** Requirement: front matter scan covers at most the document head 4KB. */
export const FRONT_MATTER_SCAN_LIMIT = 4096

/**
 * Parse a leading `---\n…\n---` YAML front-matter block.
 * Returns null when the document does not open with a closed fence pair.
 */
export function parseFrontMatter(
  text: string,
  limit = FRONT_MATTER_SCAN_LIMIT
): FrontMatterResult | null {
  const head = text.slice(0, limit)
  const m = /^(?:﻿)?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(head)
  if (!m) return null
  return {
    yaml: m[1],
    end: m[0].length,
    summary: summarizeYaml(m[1])
  }
}

function stripQuotes(v: string): string {
  return v.replace(/^["']|["']$/g, '')
}

/** Best-effort key/value summary — enough for the collapsed card. */
export function summarizeYaml(yaml: string): FrontMatterSummary {
  const keys: string[] = []
  const summary: FrontMatterSummary = { keys }
  const lines = yaml.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const km = /^([A-Za-z0-9_-]+)[ \t]*:[ \t]*(.*)$/.exec(lines[i])
    if (!km) continue
    const key = km[1]
    const raw = km[2].trim()
    keys.push(key)
    const lower = key.toLowerCase()
    if (lower === 'title' && raw && summary.title === undefined) {
      summary.title = stripQuotes(raw)
    } else if (lower === 'date' && raw && summary.date === undefined) {
      summary.date = stripQuotes(raw)
    } else if (lower === 'tags' && summary.tags === undefined) {
      const tags: string[] = []
      if (raw) {
        const inner = raw.replace(/^\[/, '').replace(/\]$/, '')
        for (const t of inner.split(/[,，]/)) {
          const v = stripQuotes(t.trim())
          if (v) tags.push(v)
        }
      } else {
        // Block-array style: following indented `- item` lines.
        for (let j = i + 1; j < lines.length; j++) {
          const am = /^[ \t]+-[ \t]+(.+)$/.exec(lines[j])
          if (!am) break
          const v = stripQuotes(am[1].trim())
          if (v) tags.push(v)
        }
      }
      summary.tags = tags
    }
  }
  return summary
}

// ---- footnotes ---------------------------------------------------------------

/** `[^id]: definition text` on its own line (id: no spaces/brackets). */
export const FOOTNOTE_DEF_RE = /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/
/** `[^id]` reference marker. */
export const FOOTNOTE_REF_RE = /\[\^([^\]\s]+)\]/g

export interface FootnoteDef {
  id: string
  /**
   * 1-based number by first-reference order. Definitions never referenced
   * get numbers after all referenced ones (display fallback).
   */
  num: number
  /** Document offset of the `[^id]` marker on the definition line. */
  defFrom: number
  defTo: number
  text: string
}

/** Collect footnote definitions + assign display numbers. */
export function collectFootnoteDefs(docText: string): Map<string, FootnoteDef> {
  const defs = new Map<string, FootnoteDef>()
  const lines = docText.split('\n')
  const lineFroms: number[] = []
  let offset = 0
  for (const line of lines) {
    lineFroms.push(offset)
    const m = FOOTNOTE_DEF_RE.exec(line)
    if (m && !defs.has(m[1])) {
      defs.set(m[1], {
        id: m[1],
        num: 0,
        defFrom: offset,
        defTo: offset + m[0].length,
        text: m[2]
      })
    }
    offset += line.length + 1
  }
  // Number by first reference appearance outside definition lines.
  let num = 0
  const seen = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    if (FOOTNOTE_DEF_RE.test(lines[i])) continue
    for (const m of lines[i].matchAll(FOOTNOTE_REF_RE)) {
      const id = m[1]
      if (seen.has(id)) continue
      seen.add(id)
      const def = defs.get(id)
      if (def) def.num = ++num
    }
  }
  for (const def of defs.values()) {
    if (def.num === 0) def.num = ++num
  }
  return defs
}

// ---- other extended patterns -------------------------------------------------

/** `==highlight==` (pandoc / Typora). */
export const HIGHLIGHT_RE = /==([^=\n]+)==/g
/** `2^10^` pandoc superscript; lookarounds keep `^^` sequences out. */
export const SUP_RE = /\^([^\^\n]+?)\^/g
/** `H~2~O` pandoc subscript; lookarounds keep `~~strikethrough~~` out. */
export const SUB_RE = /(?<!~)~([^~\n]+?)~(?!~)/g
/** `*[HTML]: Hyper Text Markup Language` abbreviation definition line. */
export const ABBR_DEF_RE = /^\*\[([^\]]+)\]:[ \t]*(.*)$/
/** Definition-list body line: `: definition`. */
export const DL_DEF_RE = /^([ \t]*):[ \t]+(\S.*)$/
/** Trailing inline attributes `{#id .class}`. */
export const ATTR_RE = /\{((?:[#.][\w-]+[ \t]*)+)\}[ \t]*$/

/** Parsed `{#id .class}` attribute string. */
export interface InlineAttrs {
  id: string | null
  classes: string[]
}

export function parseAttrString(s: string): InlineAttrs {
  let id: string | null = null
  const classes: string[] = []
  for (const tok of s.split(/\s+/).filter(Boolean)) {
    if (tok.startsWith('#') && tok.length > 1) {
      if (id == null) id = tok.slice(1)
    } else if (tok.startsWith('.') && tok.length > 1) {
      classes.push(tok.slice(1))
    }
  }
  return { id, classes }
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---- CDP test hooks (scripts/cdp-p11.mjs) ------------------------------------
declare global {
  interface Window {
    __veloxExtended: {
      parseFrontMatter: typeof parseFrontMatter
      collectFootnoteDefs: typeof collectFootnoteDefs
      parseAttrString: typeof parseAttrString
    } | null
  }
}
if (typeof window !== 'undefined') {
  window.__veloxExtended = { parseFrontMatter, collectFootnoteDefs, parseAttrString }
}
