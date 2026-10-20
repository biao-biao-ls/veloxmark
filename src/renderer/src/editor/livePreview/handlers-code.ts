import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { Decoration } from '@codemirror/view'
import { hide, type BuildCtx } from './handlers-ctx'
import { CodeBlockWidget, CodeLangChip } from '../codeBlock-widget'
import { MermaidPreviewWidget, MermaidWidget } from '../mermaid'
import { previewBelow } from './dualPane'
import { TableWidget } from '../table/widget'
import { getTableEdit } from '../table/state'
import { codeBlockKey, getCodeBlockExpanded } from './codeBlockUi'


export function enterTable(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const doc = ctx.state.doc
  const lineFrom = doc.lineAt(node.from).from
  const lineTo = doc.lineAt(node.to).to
  const edit = getTableEdit(ctx.state)
  const active = edit.active
  const isActive = active != null && active.tableFrom === lineFrom
  const isEditing = isActive || edit.editFrom === lineFrom
  if (!isEditing && ctx.blockTouched(node.from, node.to)) return false
  const source = ctx.state.sliceDoc(lineFrom, lineTo)
  ctx.decos.push({
    from: lineFrom,
    to: lineTo,
    value: Decoration.replace({
      widget: new TableWidget(source, lineFrom, lineTo, {
        active: isActive ? { row: active.row, col: active.col, caret: active.caret } : null,
        editing: isEditing,
        colWidths: edit.colWidths.get(lineFrom),
        theme: ctx.config.theme,
        i18nEpoch: ctx.config.i18nEpoch ?? 0
      }),
      block: true
    })
  })
  return false
}


export function enterFencedCode(node: SyntaxNodeRef, ctx: BuildCtx): boolean {
  const state = ctx.state
  const infoNode = node.node.getChild('CodeInfo')
  const lang = infoNode ? state.sliceDoc(infoNode.from, infoNode.to).trim() : ''

  if (ctx.blockTouched(node.from, node.to)) {
    buildFocusedCodePanel(node, lang, infoNode, ctx)
    if (lang === 'mermaid') {
      const doc = state.doc
      const last = doc.lineAt(node.to)
      ctx.decos.push(
        previewBelow(
          Math.min(last.to + 1, doc.length),
          new MermaidPreviewWidget(
            fenceBody(state, node),
            node.from,
            node.to,
            ctx.config.theme,
            ctx.config.i18nEpoch ?? 0
          )
        )
      )
    }
    return false
  }

  const code = fenceBody(state, node)

  const doc = state.doc
  const lineFrom = doc.lineAt(node.from).from
  const lineTo = doc.lineAt(node.to).to
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

function fenceBody(state: BuildCtx['state'], node: SyntaxNodeRef): string {
  const textNode = node.node.getChild('CodeText')
  let code = textNode ? state.sliceDoc(textNode.from, textNode.to) : ''
  if (code.startsWith('\n')) code = code.slice(1)
  if (code.endsWith('\n')) code = code.slice(0, -1)
  return code
}

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
  const closeMark = marks.length > 1 ? marks[marks.length - 1] : null

  for (let line = first; ; line = doc.lineAt(line.to + 1)) {
    const isFirst = line.from === first.from
    const isLast = line.from === last.from
    const tuck = (isFirst || isLast) && !ctx.touched(line.from, line.to)
    const cls =
      'cm-md-code-src' +
      (isFirst ? ' cm-md-code-src-first' : '') +
      (!isFirst && !isLast ? ' cm-md-code-src-body' : '') +
      (isLast ? ' cm-md-code-src-last' : '') +
      (tuck ? ' cm-md-code-src-tuck' : '')
    ctx.decos.push({
      from: line.from,
      to: line.from,
      value: Decoration.line({ class: cls })
    })
    if (isLast) break
  }

  if (openMark) {
    const openTo = infoNode ? infoNode.to : openMark.to
    ctx.decos.push({ from: openMark.from, to: openTo, value: hide })
  }
  if (closeMark) {
    ctx.decos.push({
      from: closeMark.from,
      to: closeMark.to,
      value: Decoration.replace({
        widget: new CodeLangChip(lang, node.from, ctx.config.i18nEpoch ?? 0)
      })
    })
  }

}
