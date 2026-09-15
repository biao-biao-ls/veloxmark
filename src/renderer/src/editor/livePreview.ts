import { syntaxTree } from '@codemirror/language'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import type { SyntaxNodeRef } from '@lezer/common'
import type { ThemeName } from './theme'
import {
  CodeBlockWidget,
  ImageWidget,
  InlineMathWidget,
  MathBlockWidget,
  MermaidWidget,
  TableWidget
} from './widgets'

/**
 * Live-preview decorations.
 *
 * NOTE: CodeMirror only allows block widgets and multi-line replace decorations
 * from state fields (not view plugins), which is why this is a StateField.
 */

/** Force decorations to rebuild (e.g. after a theme switch). */
export const forceRefresh = StateEffect.define<null>()

/** Config read at decoration-build time. Updated by the App shell. */
export const livePreviewConfig = {
  theme: 'light' as ThemeName,
  baseDir: ''
}

const hide = Decoration.replace({})
const markEm = Decoration.mark({ class: 'cm-md-em' })
const markStrong = Decoration.mark({ class: 'cm-md-strong' })
const markDel = Decoration.mark({ class: 'cm-md-del' })
const markCode = Decoration.mark({ class: 'cm-md-inline-code' })
const markLink = Decoration.mark({ class: 'cm-md-link' })

interface PendingDeco {
  from: number
  to: number
  value: Decoration
}

function nodeText(state: EditorState, node: SyntaxNodeRef): string {
  return state.sliceDoc(node.from, node.to)
}

function listDepth(node: SyntaxNodeRef): number {
  let depth = 0
  for (let p = node.node.parent; p; p = p.parent) {
    if (p.name === 'List') depth++
  }
  return Math.min(Math.max(depth, 1), 6)
}

function quoteDepth(node: SyntaxNodeRef): number {
  let depth = 0
  for (let p = node.node.parent; p; p = p.parent) {
    if (p.name === 'Blockquote') depth++
  }
  return Math.min(Math.max(depth, 1), 4)
}

function buildDecorations(state: EditorState): DecorationSet {
  const decos: PendingDeco[] = []
  const tree = syntaxTree(state)
  const selections = state.selection.ranges
  const { theme, baseDir } = livePreviewConfig
  const doc = state.doc

  /** True when any cursor/selection touches the half-open range [from, to]. */
  const touched = (from: number, to: number): boolean =>
    selections.some((r) => {
      const lineFrom = doc.lineAt(r.from).from
      const lineTo = doc.lineAt(r.to).to
      return from <= lineTo && to >= lineFrom
    })

  /** True when any cursor/selection lies inside the block [from, to]. */
  const blockTouched = (from: number, to: number): boolean =>
    selections.some((r) => (r.from >= from && r.from <= to) || (r.to >= from && r.to <= to))

  tree.iterate({
    enter: (node) => {
      const name = node.node.name

      // ---- headings --------------------------------------------------------
      const atx = /^ATXHeading([1-6])$/.exec(name)
      if (atx) {
        const level = Number(atx[1])
        const line = doc.lineAt(node.from)
        decos.push({
          from: line.from,
          to: line.from,
          value: Decoration.line({ class: `cm-md-heading cm-md-h${level}` })
        })
        return true
      }

      if (name === 'HeaderMark' && node.node.parent?.name.startsWith('ATXHeading')) {
        if (!touched(node.from, node.to)) {
          // Hide '#' markers plus one trailing space when present
          const end = doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
          decos.push({ from: node.from, to: end, value: hide })
        }
        return false
      }

      // ---- emphasis / strong / strikethrough ------------------------------
      if (name === 'EmphasisMark') {
        if (!touched(node.from, node.to)) {
          decos.push({ from: node.from, to: node.to, value: hide })
        }
        return false
      }
      if (name === 'Emphasis') {
        decos.push({ from: node.from, to: node.to, value: markEm })
      } else if (name === 'StrongEmphasis') {
        decos.push({ from: node.from, to: node.to, value: markStrong })
      } else if (name === 'Strikethrough') {
        decos.push({ from: node.from, to: node.to, value: markDel })
      } else if (name === 'StrikethroughMark') {
        if (!touched(node.from, node.to)) {
          decos.push({ from: node.from, to: node.to, value: hide })
        }
        return false
      }

      // ---- inline code -----------------------------------------------------
      if (name === 'InlineCode') {
        decos.push({ from: node.from, to: node.to, value: markCode })
        if (!touched(node.from, node.to)) {
          for (let c = node.node.firstChild; c; c = c.nextSibling) {
            if (c.name === 'CodeMark') {
              decos.push({ from: c.from, to: c.to, value: hide })
            }
          }
        }
        return false
      }

      // ---- links -----------------------------------------------------------
      if (name === 'Link' || name === 'Autolink') {
        decos.push({ from: node.from, to: node.to, value: markLink })
        if (!touched(node.from, node.to)) {
          for (let c = node.node.firstChild; c; c = c.nextSibling) {
            if (c.name === 'LinkMark' || c.name === 'URL') {
              decos.push({ from: c.from, to: c.to, value: hide })
            }
          }
        }
        return false
      }

      // ---- images ----------------------------------------------------------
      if (name === 'Image') {
        if (!blockTouched(node.from, node.to)) {
          const m = /^!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)$/.exec(
            nodeText(state, node)
          )
          if (m) {
            decos.push({
              from: node.from,
              to: node.to,
              value: Decoration.replace({
                widget: new ImageWidget(m[1], m[2], baseDir)
              })
            })
          }
        }
        return false
      }

      // ---- lists -----------------------------------------------------------
      if (name === 'ListMark') {
        const line = doc.lineAt(node.from)
        if (!touched(line.from, node.to)) {
          const end = doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
          decos.push({ from: line.from, to: end, value: hide })
        }
        decos.push({
          from: line.from,
          to: line.from,
          value: Decoration.line({
            class: `cm-md-list cm-md-list-d${listDepth(node)}`
          })
        })
        return false
      }

      // ---- blockquotes -----------------------------------------------------
      if (name === 'QuoteMark') {
        const line = doc.lineAt(node.from)
        if (!touched(line.from, node.to)) {
          const end = doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
          decos.push({ from: line.from, to: end, value: hide })
        }
        decos.push({
          from: line.from,
          to: line.from,
          value: Decoration.line({ class: `cm-md-quote cm-md-quote-d${quoteDepth(node)}` })
        })
        return false
      }

      // ---- tables ------------------------------------------------------------
      if (name === 'Table') {
        if (blockTouched(node.from, node.to)) return false
        const lineFrom = doc.lineAt(node.from).from
        const lineTo = doc.lineAt(node.to).to
        const source = state.sliceDoc(lineFrom, lineTo)
        decos.push({
          from: lineFrom,
          to: lineTo,
          value: Decoration.replace({
            widget: new TableWidget(source, node.from, node.to),
            block: true
          })
        })
        return false
      }

      // ---- fenced code / mermaid -------------------------------------------
      if (name === 'FencedCode') {
        if (blockTouched(node.from, node.to)) return false
        const infoNode = node.node.getChild('CodeInfo')
        const lang = infoNode ? state.sliceDoc(infoNode.from, infoNode.to).trim() : ''
        const textNode = node.node.getChild('CodeText')
        let code = textNode ? state.sliceDoc(textNode.from, textNode.to) : ''
        if (code.startsWith('\n')) code = code.slice(1)
        if (code.endsWith('\n')) code = code.slice(0, -1)

        const lineFrom = doc.lineAt(node.from).from
        const lineTo = doc.lineAt(node.to).to
        const widget =
          lang === 'mermaid'
            ? new MermaidWidget(code, node.from, node.to, theme)
            : new CodeBlockWidget(code, lang, node.from, node.to)
        decos.push({
          from: lineFrom,
          to: lineTo,
          value: Decoration.replace({ widget, block: true })
        })
        return false
      }

      // ---- horizontal rule -------------------------------------------------
      if (name === 'HorizontalRule') {
        const line = doc.lineAt(node.from)
        if (!touched(line.from, node.to)) {
          decos.push({ from: node.from, to: node.to, value: hide })
        }
        decos.push({
          from: line.from,
          to: line.from,
          value: Decoration.line({ class: 'cm-md-hr' })
        })
        return false
      }

      // ---- task list checkboxes --------------------------------------------
      if (name === 'TaskMarker') {
        if (!touched(node.from, node.to)) {
          const text = nodeText(state, node)
          decos.push({
            from: node.from,
            to: node.to,
            value: Decoration.replace({
              widget: new TaskWidget(node.from, text.includes('x'))
            })
          })
        }
        return false
      }

      return true
    }
  })

  // ---- math (regex pass; @lezer/markdown has no math extension) -------------
  const mathBlockRanges: Array<[number, number]> = []

  for (const range of [{ from: 0, to: doc.length }]) {
    const { from, to } = range
    const text = state.sliceDoc(from, to)

    // multi-line: $$ on its own lines
    const multiRe = /^([ \t]*\$\$[ \t]*\n)([\s\S]+?)(\n[ \t]*\$\$[ \t]*)$/gm
    for (const m of text.matchAll(multiRe)) {
      const start = from + m.index!
      const end = start + m[0].length
      const lineFrom = doc.lineAt(start).from
      const lineTo = doc.lineAt(end - 1).to
      mathBlockRanges.push([lineFrom, lineTo])
      if (blockTouched(lineFrom, lineTo)) continue
      decos.push({
        from: lineFrom,
        to: lineTo,
        value: Decoration.replace({
          widget: new MathBlockWidget(m[2].trim(), start, end),
          block: true
        })
      })
    }

    // single-line: $$formula$$
    const singleRe = /^([ \t]*)\$\$([^$\n]+)\$\$[ \t]*$/gm
    for (const m of text.matchAll(singleRe)) {
      const start = from + m.index!
      const lineFrom = doc.lineAt(start).from
      const lineTo = doc.lineAt(start + m[0].length - 1).to
      if (mathBlockRanges.some(([a, b]) => lineFrom <= b && lineTo >= a)) continue
      mathBlockRanges.push([lineFrom, lineTo])
      if (blockTouched(lineFrom, lineTo)) continue
      decos.push({
        from: lineFrom,
        to: lineTo,
        value: Decoration.replace({
          widget: new MathBlockWidget(m[2].trim(), start, start + m[0].length),
          block: true
        })
      })
    }

    // inline: $tex$ — not inside code, not $$, content has no leading/trailing space
    const inlineRe = /\$([^$\n]+?)\$/g
    for (const m of text.matchAll(inlineRe)) {
      const start = from + m.index!
      const end = start + m[0].length
      const content = m[1]
      if (content !== content.trim()) continue
      if (content.includes('$$')) continue
      if (mathBlockRanges.some(([a, b]) => start <= b && end >= a)) continue
      // skip math-looking text inside code nodes
      const chain = tree.resolveInner(start, 1)
      let inCode = false
      for (let p: typeof chain | null = chain; p; p = p.parent) {
        if (
          p.name === 'InlineCode' ||
          p.name === 'FencedCode' ||
          p.name === 'CodeText' ||
          p.name === 'URL'
        ) {
          inCode = true
          break
        }
      }
      if (inCode) continue
      if (blockTouched(start, end)) continue
      decos.push({
        from: start,
        to: end,
        value: Decoration.replace({ widget: new InlineMathWidget(content) })
      })
    }
  }

  return Decoration.set(decos, true)
}

class TaskWidget extends WidgetType {
  constructor(
    readonly sourceFrom: number,
    readonly checked: boolean
  ) {
    super()
  }

  eq(other: TaskWidget): boolean {
    return other.sourceFrom === this.sourceFrom && other.checked === this.checked
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'cm-md-task'
    input.checked = this.checked
    input.addEventListener('mousedown', (e) => e.stopPropagation())
    input.addEventListener('change', () => {
      view.dispatch({
        changes: {
          from: this.sourceFrom + 1,
          to: this.sourceFrom + 2,
          insert: input.checked ? 'x' : ' '
        }
      })
    })
    return input
  }

  ignoreEvent(): boolean {
    return false
  }
}

export const livePreviewField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state)
  },
  update(value, tr) {
    // The markdown parser works asynchronously in chunks and announces new
    // trees via a transaction without doc/selection changes — rebuild then too.
    const treeChanged = syntaxTree(tr.startState) !== syntaxTree(tr.state)
    if (
      tr.docChanged ||
      tr.selection ||
      treeChanged ||
      tr.effects.some((e) => e.is(forceRefresh))
    ) {
      return buildDecorations(tr.state)
    }
    return value.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f)
})
