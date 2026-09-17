import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { Decoration, type DecorationSet } from '@codemirror/view'
import type { LivePreviewConfig } from './config'
import {
  collectMathDecos,
  enterEmphasisMark,
  enterFencedCode,
  enterHeaderMark,
  enterHeading,
  enterHorizontalRule,
  enterImage,
  enterInlineCode,
  enterInlineMark,
  enterLink,
  enterListMark,
  enterQuoteMark,
  enterStrikethroughMark,
  enterTable,
  enterTaskMarker,
  type BuildCtx,
  type PendingDeco
} from './handlers'

/**
 * Build all live-preview decorations for a document.
 *
 * Pure with respect to module state: every piece of configuration arrives
 * via the `config` argument, so this runs in a plain node environment
 * (EditorState.create + buildDecorations) for snapshot tests (P15).
 */
export function buildDecorations(state: EditorState, config: LivePreviewConfig): DecorationSet {
  // P08 source mode: raw Markdown — no live-preview decorations at all.
  // Syntax highlighting (theme HighlightStyle) and line numbers are
  // independent of this field and stay on.
  if (config.mode === 'source') return Decoration.none

  const decos: PendingDeco[] = []
  const tree = syntaxTree(state)
  const selections = state.selection.ranges
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

  const ctx: BuildCtx = { state, config, decos, touched, blockTouched }

  // tree.iterate's enter only dispatches; each syntax kind lives in handlers.ts
  tree.iterate({
    enter: (node) => {
      const name = node.node.name

      const atx = /^ATXHeading([1-6])$/.exec(name)
      if (atx) return enterHeading(Number(atx[1]), node, ctx)

      if (name === 'HeaderMark' && node.node.parent?.name.startsWith('ATXHeading')) {
        return enterHeaderMark(node, ctx)
      }
      if (name === 'EmphasisMark') return enterEmphasisMark(node, ctx)
      if (name === 'Emphasis' || name === 'StrongEmphasis' || name === 'Strikethrough') {
        return enterInlineMark(node, ctx)
      }
      if (name === 'StrikethroughMark') return enterStrikethroughMark(node, ctx)
      if (name === 'InlineCode') return enterInlineCode(node, ctx)
      if (name === 'Link' || name === 'Autolink') return enterLink(node, ctx)
      if (name === 'Image') return enterImage(node, ctx)
      if (name === 'ListMark') return enterListMark(node, ctx)
      if (name === 'QuoteMark') return enterQuoteMark(node, ctx)
      if (name === 'Table') return enterTable(node, ctx)
      if (name === 'FencedCode') return enterFencedCode(node, ctx)
      if (name === 'HorizontalRule') return enterHorizontalRule(node, ctx)
      if (name === 'TaskMarker') return enterTaskMarker(node, ctx)

      return true
    }
  })

  collectMathDecos(ctx, (pos, side) => tree.resolveInner(pos, side))

  // P08 focus mode: mark every line of the top-level block the cursor is in.
  // CSS dims all other .cm-line elements via the .cm-focus-mode root class.
  if (config.focusMode) {
    const head = selections[0]?.head ?? 0
    let block = tree.topNode.firstChild
    while (block) {
      if (block.from <= head && head <= block.to) {
        for (let line = doc.lineAt(block.from); ; ) {
          decos.push({
            from: line.from,
            to: line.from,
            value: Decoration.line({ class: 'cm-focus-active' })
          })
          if (line.to >= block.to || line.to >= doc.length) break
          line = doc.lineAt(line.to + 1)
        }
        break
      }
      block = block.nextSibling
    }
  }

  return Decoration.set(decos, true)
}
