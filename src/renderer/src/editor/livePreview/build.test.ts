import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { Decoration } from '@codemirror/view'
import { buildDecorations } from './build'
import { DEFAULT_LIVE_PREVIEW_CONFIG, type LivePreviewConfig } from './config'

interface DecoHit {
  from: number
  to: number
  className: string | undefined
  widgetName: string | null
  /** P28: widgets exposing a `lang` field (CodeLangChip) surface it here. */
  widgetLang: string | null
  block: boolean
}

function build(doc: string, selection?: number, config: Partial<LivePreviewConfig> = {}) {
  const state = EditorState.create({
    doc,
    ...(selection != null ? { selection: { anchor: selection } } : {}),
    extensions: [markdown()]
  })
  ensureSyntaxTree(state, doc.length, 50000)
  const set = buildDecorations(state, { ...DEFAULT_LIVE_PREVIEW_CONFIG, ...config })
  const hits: DecoHit[] = []
  set.between(0, state.doc.length, (from, to, value) => {
    const spec = (value as Decoration).spec as {
      class?: string
      widget?: { constructor: { name: string }; lang?: string }
      block?: boolean
    }
    hits.push({
      from,
      to,
      className: spec.class,
      widgetName: spec.widget ? spec.widget.constructor.name : null,
      widgetLang: spec.widget ? (spec.widget.lang ?? null) : null,
      block: spec.block === true
    })
  })
  return { state, hits }
}

/** True when some decoration is an empty replace spanning [from, to) — the hidden-marker shape. */
const hasHiddenRange = (hits: DecoHit[], from: number, to: number): boolean =>
  hits.some(
    (h) => h.from === from && h.to === to && h.className === undefined && h.widgetName === null
  )

const classesOf = (hits: DecoHit[]) => new Set(hits.map((h) => h.className).filter(Boolean))

describe('buildDecorations', () => {
  it('marks ATX headings with level classes when the cursor is elsewhere', () => {
    const doc = '# Title\n\nbody text here\n'
    const { hits } = build(doc, doc.indexOf('body'))
    // Line decorations carry a combined class string.
    const headingLine = hits.find((h) => h.className?.includes('cm-md-heading'))
    expect(headingLine).toBeTruthy()
    expect(headingLine!.className).toContain('cm-md-h1')
  })

  it('applies strong/emphasis marks when not touched by the selection', () => {
    const doc = 'intro **bold** and *em* tail\n'
    const { hits } = build(doc, 0)
    const classes = classesOf(hits)
    expect(classes.has('cm-md-strong')).toBe(true)
    expect(classes.has('cm-md-em')).toBe(true)
  })

  it('hides ** markers away from the cursor and reveals them when touched (P09)', () => {
    const doc = 'intro **bold** tail\n'
    const openFrom = doc.indexOf('**')
    const openTo = openFrom + 2
    const away = build(doc, 0)
    expect(hasHiddenRange(away.hits, openFrom, openTo)).toBe(true)
    const touched = build(doc, doc.indexOf('bold') + 1)
    expect(hasHiddenRange(touched.hits, openFrom, openTo)).toBe(false)
    // Content styling class is independent of marker visibility.
    expect(classesOf(touched.hits).has('cm-md-strong')).toBe(true)
  })

  it('collapses $$block$$ math into a block widget', () => {
    const doc = 'before\n\n$$E = mc^2$$\n\nafter\n'
    const { hits } = build(doc, doc.indexOf('after'))
    const math = hits.find((h) => h.widgetName === 'MathBlockWidget')
    expect(math).toBeTruthy()
    expect(math!.block).toBe(true)
  })

  it('collapses $inline$ math into an inline widget', () => {
    const doc = 'value $x^2$ here\n'
    const { hits } = build(doc, 0)
    expect(hits.some((h) => h.widgetName === 'InlineMathWidget')).toBe(true)
  })

  it('does not treat $…$ inside inline code as math', () => {
    const doc = 'code `$not-math$` stays\n'
    const { hits } = build(doc, 0)
    expect(hits.some((h) => h.widgetName === 'InlineMathWidget')).toBe(false)
  })

  it('does not treat $…$ inside fenced code as math (P15 skip-ranges)', () => {
    const doc = '```sh\necho $HOME\n```\n\ntail\n'
    const { hits } = build(doc, doc.indexOf('tail'))
    expect(hits.some((h) => h.widgetName && h.widgetName.includes('Math'))).toBe(false)
  })

  it('source mode returns no decorations at all', () => {
    const doc = '# Title\n\n**bold** $$x$$\n'
    const { hits } = build(doc, 0, { mode: 'source' })
    expect(hits).toEqual([])
  })

  it('adds P11 front-matter / highlight decorations', () => {
    const doc = '---\ntitle: T\n---\n\n==important== line\n'
    const { hits } = build(doc, doc.length - 1)
    // Front matter collapses into a block widget (DOM classes live on the widget).
    const fm = hits.find((h) => h.widgetName === 'FrontMatterWidget')
    expect(fm).toBeTruthy()
    expect(fm!.block).toBe(true)
    // ==highlight== content gets a mark class; its == delimiters are hidden
    // away from the cursor.
    expect(classesOf(hits).has('cm-md-highlight')).toBe(true)
    const hlStart = doc.indexOf('==important==')
    expect(hasHiddenRange(hits, hlStart, hlStart + 2)).toBe(true)
  })
})

// ---- P28: focused code-block panel ------------------------------------------

describe('P28 focused code-block panel', () => {
  const DOC = 'before\n\n```js\nconst x = 1\nconst y = 2\n```\n\nafter\n'
  const OPEN_FROM = DOC.indexOf('```js')
  const OPEN_TO = OPEN_FROM + '```js'.length
  const CLOSE_FROM = DOC.lastIndexOf('```')

  const lineClassAt = (hits: DecoHit[], pos: number): string | undefined =>
    hits.find((h) => h.from === pos && h.className?.includes('cm-md-code-src'))?.className

  it('cursor in fence body → panel line classes + chip + hidden closing fence', () => {
    const { hits } = build(DOC, DOC.indexOf('const x') + 3)
    // No rendered widget while focused — panel replaces it.
    expect(hits.some((h) => h.widgetName === 'CodeBlockWidget')).toBe(false)
    // Three-segment chrome: first / body×2 / last (fence lines + 2 code lines).
    expect(lineClassAt(hits, OPEN_FROM)).toContain('cm-md-code-src-first')
    expect(lineClassAt(hits, DOC.indexOf('const x'))).toContain('cm-md-code-src-body')
    expect(lineClassAt(hits, DOC.indexOf('const y'))).toContain('cm-md-code-src-body')
    expect(lineClassAt(hits, CLOSE_FROM)).toContain('cm-md-code-src-last')
    // Opening ```js hidden → replaced by the language chip.
    const chip = hits.find((h) => h.widgetName === 'CodeLangChip')
    expect(chip).toBeTruthy()
    expect(chip!.from).toBe(OPEN_FROM)
    expect(chip!.to).toBe(OPEN_TO)
    expect(chip!.widgetLang).toBe('js')
    // Closing ``` hidden (empty replace).
    expect(hasHiddenRange(hits, CLOSE_FROM, CLOSE_FROM + 3)).toBe(true)
  })

  it('cursor on the opening fence line reveals ```lang (chip gone), closing stays hidden', () => {
    const { hits } = build(DOC, OPEN_FROM + 2)
    expect(hits.some((h) => h.widgetName === 'CodeLangChip')).toBe(false)
    // Panel chrome still applies while the cursor is on the fence line.
    expect(lineClassAt(hits, OPEN_FROM)).toContain('cm-md-code-src-first')
    // Closing fence untouched → still hidden.
    expect(hasHiddenRange(hits, CLOSE_FROM, CLOSE_FROM + 3)).toBe(true)
  })

  it('cursor on the closing fence line reveals it (hide gone), chip still shown', () => {
    const { hits } = build(DOC, CLOSE_FROM + 1)
    expect(hasHiddenRange(hits, CLOSE_FROM, CLOSE_FROM + 3)).toBe(false)
    expect(hits.some((h) => h.widgetName === 'CodeLangChip')).toBe(true)
  })

  it('cursor outside the fence → rendered CodeBlockWidget, no panel/chip', () => {
    const { hits } = build(DOC, DOC.indexOf('after'))
    const widget = hits.find((h) => h.widgetName === 'CodeBlockWidget')
    expect(widget).toBeTruthy()
    expect(widget!.block).toBe(true)
    expect(hits.some((h) => h.widgetName === 'CodeLangChip')).toBe(false)
    expect(hits.some((h) => h.className?.includes('cm-md-code-src'))).toBe(false)
  })

  it('fence with no language → chip falls back to "text"', () => {
    const doc = '```\nplain\n```\n\ntail\n'
    const { hits } = build(doc, doc.indexOf('plain') + 1)
    const chip = hits.find((h) => h.widgetName === 'CodeLangChip')
    expect(chip).toBeTruthy()
    expect(chip!.widgetLang).toBe('')
  })

  it('mermaid fence focused → panel + chip(lang=mermaid), no MermaidWidget', () => {
    const doc = '```mermaid\ngraph TD;\n  A-->B\n```\n\ntail\n'
    const { hits } = build(doc, doc.indexOf('graph') + 1)
    expect(hits.some((h) => h.widgetName === 'MermaidWidget')).toBe(false)
    const chip = hits.find((h) => h.widgetName === 'CodeLangChip')
    expect(chip).toBeTruthy()
    expect(chip!.widgetLang).toBe('mermaid')
    const openFrom = doc.indexOf('```mermaid')
    expect(lineClassAt(hits, openFrom)).toContain('cm-md-code-src-first')
  })

  it('source mode → no panel decorations even with the cursor in a fence', () => {
    const { hits } = build(DOC, DOC.indexOf('const x') + 3, { mode: 'source' })
    expect(hits).toEqual([])
  })
})

// ---- P29: focused panel syntax highlight (hljs token marks) ------------------

describe('P29 focused code-block hljs token marks', () => {
  const DOC = 'before\n\n```js\nconst x = 1\nconst y = 2\n```\n\nafter\n'
  const CONTENT_FROM = DOC.indexOf('const x')
  const CONTENT_TO = DOC.lastIndexOf('```')

  const hljsHits = (hits: DecoHit[]) =>
    hits.filter((h) => h.className && /(^|\s)hljs-/.test(h.className))

  it('focused js fence → hljs token marks inside the content region', () => {
    const { hits } = build(DOC, DOC.indexOf('const x') + 3)
    const tokens = hljsHits(hits)
    expect(tokens.length).toBeGreaterThan(0)
    expect(tokens.some((h) => h.className!.includes('hljs-keyword'))).toBe(true)
    for (const h of tokens) {
      expect(h.from).toBeGreaterThanOrEqual(CONTENT_FROM)
      expect(h.to).toBeLessThanOrEqual(CONTENT_TO)
      // Token classes only — never the bare `hljs` base class.
      expect(h.className).not.toBe('hljs')
      expect(h.className).not.toMatch(/(^|\s)hljs(\s|$)/)
    }
    // Marks never reach the fence/chip replace ranges.
    const openFrom = DOC.indexOf('```js')
    expect(tokens.some((h) => h.from < CONTENT_FROM && h.to > openFrom)).toBe(false)
  })

  it('entity-heavy code still maps marks to real document offsets', () => {
    const doc = '```js\nif (a < b && c > d) x = "s"\n```\n\ntail\n'
    const { hits } = build(doc, doc.indexOf('if') + 1)
    const tokens = hljsHits(hits)
    const kw = tokens.find((h) => h.className!.includes('hljs-keyword'))
    expect(kw).toBeTruthy()
    // `if` sits at the start of the content line.
    expect(doc.slice(kw!.from, kw!.to)).toBe('if')
  })

  it('unknown language → panel chrome without any hljs marks', () => {
    const doc = '```notalang\nplain tokens here\n```\n\ntail\n'
    const { hits } = build(doc, doc.indexOf('plain') + 1)
    expect(hljsHits(hits)).toEqual([])
    // P28 panel contract still applies.
    expect(
      hits.some((h) => h.className?.includes('cm-md-code-src-first'))
    ).toBe(true)
    expect(hits.some((h) => h.widgetName === 'CodeLangChip')).toBe(true)
  })

  it('source mode → no hljs marks anywhere', () => {
    const { hits } = build(DOC, DOC.indexOf('const x') + 3, { mode: 'source' })
    expect(hljsHits(hits)).toEqual([])
  })
})
