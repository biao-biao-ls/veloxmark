import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
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
  /** 5A: line-decoration attributes (ordered-list renumber `data-vm-n`). */
  attributes: Record<string, string> | null
}

function build(doc: string, selection?: number, config: Partial<LivePreviewConfig> = {}) {
  const state = EditorState.create({
    doc,
    ...(selection != null ? { selection: { anchor: selection } } : {}),
    // GFM mirrors editor/setup.ts — without it `[x]` parses as a Link and no
    // TaskMarker node exists (5A).
    extensions: [markdown({ extensions: [GFM] })]
  })
  ensureSyntaxTree(state, doc.length, 50000)
  const set = buildDecorations(state, { ...DEFAULT_LIVE_PREVIEW_CONFIG, ...config })
  const hits: DecoHit[] = []
  set.between(0, state.doc.length, (from, to, value) => {
    const spec = (value as Decoration).spec as {
      class?: string
      widget?: { constructor: { name: string }; lang?: string }
      block?: boolean
      attributes?: Record<string, string>
    }
    hits.push({
      from,
      to,
      className: spec.class,
      widgetName: spec.widget ? spec.widget.constructor.name : null,
      widgetLang: spec.widget ? (spec.widget.lang ?? null) : null,
      block: spec.block === true,
      attributes: spec.attributes ?? null
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

  it('cursor in fence body → panel line classes + chip on closing fence + hidden opening fence', () => {
    const { hits } = build(DOC, DOC.indexOf('const x') + 3)
    // No rendered widget while focused — panel replaces it.
    expect(hits.some((h) => h.widgetName === 'CodeBlockWidget')).toBe(false)
    // Three-segment chrome: first / body×2 / last (fence lines + 2 code lines).
    expect(lineClassAt(hits, OPEN_FROM)).toContain('cm-md-code-src-first')
    expect(lineClassAt(hits, DOC.indexOf('const x'))).toContain('cm-md-code-src-body')
    expect(lineClassAt(hits, DOC.indexOf('const y'))).toContain('cm-md-code-src-body')
    expect(lineClassAt(hits, CLOSE_FROM)).toContain('cm-md-code-src-last')
    // 9A: opening ```js hidden (empty replace); the language chip parks on the
    // closing fence (bottom-right switcher).
    expect(hasHiddenRange(hits, OPEN_FROM, OPEN_TO)).toBe(true)
    const chip = hits.find((h) => h.widgetName === 'CodeLangChip')
    expect(chip).toBeTruthy()
    expect(chip!.from).toBe(CLOSE_FROM)
    expect(chip!.to).toBe(CLOSE_FROM + 3)
    expect(chip!.widgetLang).toBe('js')
  })

  it('cursor on the opening fence line reveals ```lang (open hide gone), chip stays on the closing fence', () => {
    const { hits } = build(DOC, OPEN_FROM + 2)
    expect(hasHiddenRange(hits, OPEN_FROM, OPEN_TO)).toBe(false)
    // Panel chrome still applies while the cursor is on the fence line.
    expect(lineClassAt(hits, OPEN_FROM)).toContain('cm-md-code-src-first')
    // Closing fence untouched → chip still shown.
    const chip = hits.find((h) => h.widgetName === 'CodeLangChip')
    expect(chip).toBeTruthy()
    expect(chip!.from).toBe(CLOSE_FROM)
  })

  it('cursor on the closing fence line reveals it (chip gone), opening stays hidden', () => {
    const { hits } = build(DOC, CLOSE_FROM + 1)
    expect(hits.some((h) => h.widgetName === 'CodeLangChip')).toBe(false)
    expect(hasHiddenRange(hits, CLOSE_FROM, CLOSE_FROM + 3)).toBe(false)
    expect(hasHiddenRange(hits, OPEN_FROM, OPEN_TO)).toBe(true)
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

describe('5A list rendering', () => {
  /** Line starts, excluding the phantom empty line after a trailing newline. */
  const lineFroms = (doc: string): number[] => {
    const res = [0]
    for (let i = 0; i < doc.length; i++) {
      if (doc[i] === '\n' && i < doc.length - 1) res.push(i + 1)
    }
    return res
  }
  const listLineAt = (hits: DecoHit[], pos: number) =>
    hits.find((h) => h.from === pos && h.to === pos && h.className?.includes('cm-md-list'))

  it('hides list markers and stamps depth classes (P09 hidden state)', () => {
    const doc = '- one\n  - nested\n'
    const { hits } = build(doc, doc.length - 1)
    const [l1, l2] = lineFroms(doc)
    // Top-level: hide '- ' and carry d1.
    expect(hasHiddenRange(hits, l1, l1 + 2)).toBe(true)
    expect(listLineAt(hits, l1)!.className).toContain('cm-md-list-d1')
    // Nested: hide runs line.from → marker end (source indent included).
    expect(hasHiddenRange(hits, l2, l2 + 4)).toBe(true)
    expect(listLineAt(hits, l2)!.className).toContain('cm-md-list-d2')
  })

  it('ordered lists carry build-time renumber data-vm-n', () => {
    const doc = '1. a\n1. b\n1. c\n'
    const { hits } = build(doc, doc.length - 1)
    const froms = lineFroms(doc)
    expect(listLineAt(hits, froms[0])!.className).toContain('cm-md-list-ol')
    expect(froms.map((p) => listLineAt(hits, p)!.attributes?.['data-vm-n'])).toEqual([
      '1',
      '2',
      '3'
    ])
  })

  it('nested ordered items renumber within their own list', () => {
    const doc = '1. a\n   1. x\n   1. y\n1. b\n'
    const { hits } = build(doc, doc.length - 1)
    const froms = lineFroms(doc)
    // Document order: outer 1, inner 1, inner 2, outer 2.
    expect(froms.map((p) => listLineAt(hits, p)!.attributes?.['data-vm-n'])).toEqual([
      '1',
      '1',
      '2',
      '2'
    ])
    expect(listLineAt(hits, froms[0])!.className).toContain('cm-md-list-d1')
    expect(listLineAt(hits, froms[1])!.className).toContain('cm-md-list-d2')
  })

  it('task lines get cm-md-task-item and a TaskWidget', () => {
    // Trailing paragraph keeps the cursor off the task lines — touched lines
    // reveal `[x]` source instead of the checkbox widget (P09).
    const doc = '- [x] done\n- [ ] todo\n\nend\n'
    const { hits } = build(doc, doc.indexOf('end'))
    expect(hits.filter((h) => h.widgetName === 'TaskWidget').length).toBe(2)
    for (const p of lineFroms(doc).slice(0, 2)) {
      expect(hits.some((h) => h.from === p && h.className === 'cm-md-task-item')).toBe(true)
    }
  })

  it('reveals the source marker when touched and drops the CSS marker (P09)', () => {
    const doc = '- one\n'
    const touched = build(doc, 1)
    expect(hasHiddenRange(touched.hits, 0, 2)).toBe(false)
    expect(listLineAt(touched.hits, 0)!.className).toContain('cm-md-list-open')
  })
})

// ---- 10C: mermaid language chip / lang dispatch (⑪ 10.3) --------------------
// Lang dispatch reads ONLY the fence info string (never the body) — switching
// the info via the 9A chip swaps chart rendering for plain code and back.

describe('10C mermaid lang dispatch', () => {
  const MERMAID_DOC = '```mermaid\ngraph TD;\n  A-->B\n```\n\ntail\n'
  // Same diagram-like body under a non-mermaid info string (switch-away shape).
  const JS_DOC = '```js\ngraph TD;\n  A-->B\n```\n\ntail\n'

  it('focused mermaid → MermaidPreviewWidget trails the panel, no MermaidWidget (AC1)', () => {
    const { hits } = build(MERMAID_DOC, MERMAID_DOC.indexOf('graph') + 1)
    const preview = hits.find((h) => h.widgetName === 'MermaidPreviewWidget')
    expect(preview).toBeTruthy()
    expect(preview!.block).toBe(true)
    expect(hits.some((h) => h.widgetName === 'MermaidWidget')).toBe(false)
  })

  it('focused non-mermaid fence → no MermaidPreviewWidget (AC2 switch-away)', () => {
    const { hits } = build(JS_DOC, JS_DOC.indexOf('graph') + 1)
    expect(hits.some((h) => h.widgetName === 'MermaidPreviewWidget')).toBe(false)
  })

  it('idle mermaid → MermaidWidget chart render (AC4 switch-back)', () => {
    const { hits } = build(MERMAID_DOC, MERMAID_DOC.indexOf('tail'))
    const widget = hits.find((h) => h.widgetName === 'MermaidWidget')
    expect(widget).toBeTruthy()
    expect(widget!.block).toBe(true)
  })

  it('idle non-mermaid with diagram-like body → CodeBlockWidget, not MermaidWidget (AC3)', () => {
    const { hits } = build(JS_DOC, JS_DOC.indexOf('tail'))
    expect(hits.some((h) => h.widgetName === 'CodeBlockWidget')).toBe(true)
    expect(hits.some((h) => h.widgetName === 'MermaidWidget')).toBe(false)
  })
})
