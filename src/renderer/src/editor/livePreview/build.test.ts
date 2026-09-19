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
      widget?: { constructor: { name: string } }
      block?: boolean
    }
    hits.push({
      from,
      to,
      className: spec.class,
      widgetName: spec.widget ? spec.widget.constructor.name : null,
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
