import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { Decoration } from '@codemirror/view'
import { hide, type BuildCtx } from './handlers-ctx'
import { CodeBlockWidget, CodeLangChip, MermaidWidget } from '../widgets'
import { TableWidget } from '../table/widget'
import { getTableEdit } from '../table/state'
import { codeBlockKey, getCodeBlockExpanded } from './codeBlockUi'
import { tokenRanges } from './hljsTokens'

/**
 * Table + fenced-code/mermaid handlers (split from handlers.ts, task 1D).
 *
 * Note: `enterTable` reads the table edit session (`getTableEdit`) — the
 * decoration layer intentionally knows about live editing state (an active
 * table widget must stay mounted and its source is "touched").
 */
// ---- tables -----------------------------------------------------------------

export function enterTable(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const doc = ctx.state.doc
  const lineFrom = doc.lineAt(node.from).from
  const lineTo = doc.lineAt(node.to).to
  // P10: while a cell of THIS table is being edited the widget stays mounted
  // (cell-edit state drives the DOM); otherwise keep the V1 escape hatch —
  // a CM cursor inside the table range reveals the raw source.
  const edit = getTableEdit(ctx.state)
  const active = edit.active
  const isActive = active != null && active.tableFrom === lineFrom
  if (!isActive && ctx.blockTouched(node.from, node.to)) return false
  const source = ctx.state.sliceDoc(lineFrom, lineTo)
  ctx.decos.push({
    from: lineFrom,
    to: lineTo,
    value: Decoration.replace({
      widget: new TableWidget(source, lineFrom, lineTo, {
        active: isActive ? { row: active.row, col: active.col, caret: active.caret } : null,
        colWidths: edit.colWidths.get(lineFrom),
        theme: ctx.config.theme,
        i18nEpoch: ctx.config.i18nEpoch ?? 0
      }),
      block: true
    })
  })
  return false
}

// ---- fenced code / mermaid --------------------------------------------------

export function enterFencedCode(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const state = ctx.state
  const infoNode = node.node.getChild('CodeInfo')
  const lang = infoNode ? state.sliceDoc(infoNode.from, infoNode.to).trim() : ''

  // P28: cursor inside the fence → panel chrome instead of bare ``` source.
  // The text stays document-editable (no nested editor); fence marks hide
  // with the P09 reveal-on-touch contract. Mermaid included — the P25
  // bottom preview panel is syntax-tree based and orthogonal to decorations.
  if (ctx.blockTouched(node.from, node.to)) {
    buildFocusedCodePanel(node, lang, infoNode, ctx)
    return false
  }

  const textNode = node.node.getChild('CodeText')
  let code = textNode ? state.sliceDoc(textNode.from, textNode.to) : ''
  if (code.startsWith('\n')) code = code.slice(1)
  if (code.endsWith('\n')) code = code.slice(0, -1)

  const doc = state.doc
  const lineFrom = doc.lineAt(node.from).from
  const lineTo = doc.lineAt(node.to).to
  // P24: non-mermaid blocks carry collapse/numbers/wrap UI state; expand
  // memory is keyed by content hash (session-only Set in codeBlockUiField).
  const cbKey = lang === 'mermaid' ? '' : codeBlockKey(code)
  const widget =
    lang === 'mermaid'
      ? new MermaidWidget(code, node.from, node.to, ctx.config.theme, ctx.config.i18nEpoch ?? 0)
      : new CodeBlockWidget(code, lang, node.from, node.to, {
          collapseLines: ctx.config.codeBlockCollapseLines ?? 20,
          showLineNumbers: ctx.config.codeBlockShowLineNumbers ?? false,
          wrap: ctx.config.codeBlockWrap ?? true,
          expanded: getCodeBlockExpanded(state).has(cbKey),
          key: cbKey,
          i18nEpoch: ctx.config.i18nEpoch ?? 0
        })
  ctx.decos.push({
    from: lineFrom,
    to: lineTo,
    value: Decoration.replace({ widget, block: true })
  })
  return false
}

/**
 * P28 focused-fence panel decorations (live mode only — buildDecorations
 * early-returns for source mode before any handler runs).
 *
 * 1. Line classes per fence line: base chrome on every line, `-first`/`-last`
 *    caps (a single-line unclosed fence gets both — CSS rules compose).
 * 2. Opening fence `[CodeMark.from, CodeInfo.to]` (CodeMark alone when no
 *    info string): replaced by a CodeLangChip while untouched; cursor on the
 *    line reveals raw ```lang (markTouched, P09 contract).
 * 3. Closing fence CodeMark: hidden while untouched, same reveal contract.
 */
function buildFocusedCodePanel(
  node: SyntaxNodeRef,
  lang: string,
  infoNode: SyntaxNodeRef | null,
  ctx: BuildCtx
): void {
  const doc = ctx.state.doc
  const first = doc.lineAt(node.from)
  const last = doc.lineAt(node.to)

  const marks: SyntaxNode[] = []
  for (let c = node.node.firstChild; c; c = c.nextSibling) {
    if (c.name === 'CodeMark') marks.push(c)
  }
  const openMark = marks[0] ?? null
  // Unclosed fences have a single CodeMark — no closing cap to hide.
  const closeMark = marks.length > 1 ? marks[marks.length - 1] : null

  for (let line = first; ; line = doc.lineAt(line.to + 1)) {
    const isFirst = line.from === first.from
    const isLast = line.from === last.from
    const cls =
      'cm-md-code-src' +
      (isFirst ? ' cm-md-code-src-first' : '') +
      (!isFirst && !isLast ? ' cm-md-code-src-body' : '') +
      (isLast ? ' cm-md-code-src-last' : '')
    ctx.decos.push({
      from: line.from,
      to: line.from,
      value: Decoration.line({ class: cls })
    })
    if (isLast) break
  }

  if (openMark) {
    const openTo = infoNode ? infoNode.to : openMark.to
    if (!ctx.markTouched(openMark.from, openTo)) {
      ctx.decos.push({
        from: openMark.from,
        to: openTo,
        value: Decoration.replace({ widget: new CodeLangChip(lang) })
      })
    }
  }
  if (closeMark && !ctx.markTouched(closeMark.from, closeMark.to)) {
    ctx.decos.push({ from: closeMark.from, to: closeMark.to, value: hide })
  }

  // P29: hljs token marks over the content lines only — same palette as the
  // rendered widget (scoped github/github-dark CSS). Ranges never reach the
  // fence/chip replace spans above. Unknown/empty lang or >cap → no marks.
  const contentFrom = Math.min(first.to + 1, node.to)
  const contentTo = closeMark ? doc.lineAt(closeMark.from).from : node.to
  if (contentTo > contentFrom) {
    const code = doc.sliceString(contentFrom, contentTo)
    for (const r of tokenRanges(code, lang)) {
      ctx.decos.push({
        from: contentFrom + r.from,
        to: contentFrom + r.to,
        // Token classes only — never the bare `hljs` base class (scoped CSS
        // would paint `.hljs` background boxes on every token span).
        value: Decoration.mark({ class: r.className })
      })
    }
  }
}
