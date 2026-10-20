import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { Decoration, type DecorationSet } from '@codemirror/view'
import type { LivePreviewConfig } from './config'
import { applyHeadingFoldDecos } from './fold'
import { CalloutFoldPlaceholder } from './calloutFold'
import { applyQuoteFoldDecos } from './quoteFold'
import { getLang } from '../../i18n'
import {
  collectExtendedDecos,
  collectMathDecos,
  enterCallout,
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

export function buildDecorations(state: EditorState, config: LivePreviewConfig): DecorationSet {
  if (config.mode === 'source') return Decoration.none

  const decos: PendingDeco[] = []
  const tree = syntaxTree(state)
  const selections = state.selection.ranges
  const doc = state.doc

  const touched = (from: number, to: number): boolean =>
    selections.some((r) => {
      const lineFrom = doc.lineAt(r.from).from
      const lineTo = doc.lineAt(r.to).to
      return from <= lineTo && to >= lineFrom
    })

  const blockTouched = (from: number, to: number): boolean =>
    selections.some((r) => (r.from >= from && r.from <= to) || (r.to >= from && r.to <= to))

  const markTouched = (from: number, to: number): boolean =>
    selections.some((r) => r.from <= to && r.to >= from)

  const ctx: BuildCtx = {
    state,
    config,
    decos,
    touched,
    blockTouched,
    markTouched,
    calloutFoldRanges: []
  }

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
      if (name === 'Blockquote') return enterCallout(node, ctx)
      if (name === 'QuoteMark') return enterQuoteMark(node, ctx)
      if (name === 'Table') return enterTable(node, ctx)
      if (name === 'FencedCode') return enterFencedCode(node, ctx)
      if (name === 'HorizontalRule') return enterHorizontalRule(node, ctx)
      if (name === 'TaskMarker') return enterTaskMarker(node, ctx)

      return true
    }
  })

  collectMathDecos(ctx, (pos, side) => tree.resolveInner(pos, side))
  collectExtendedDecos(ctx, (pos, side) => tree.resolveInner(pos, side))

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

  const cfRanges = ctx.calloutFoldRanges ?? []
  if (cfRanges.length > 0) {
    const keptCF = decos.filter((d) => !cfRanges.some((r) => d.from < r.to && d.to > r.from))
    decos.length = 0
    decos.push(...keptCF)
    for (const r of cfRanges) {
      decos.push({
        from: r.from,
        to: r.to,
        value: Decoration.replace({ widget: new CalloutFoldPlaceholder(r.key, r.lines, getLang()) })
      })
    }
  }

  applyQuoteFoldDecos(decos, state, cfRanges)

  applyHeadingFoldDecos(decos, state)

  return Decoration.set(decos, true)
}
