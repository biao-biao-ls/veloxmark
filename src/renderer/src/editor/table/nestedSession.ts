import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import type { ThemeName } from '../theme'
import { livePreviewConfigFacet } from '../livePreview/config'
import { hushLayers } from '../../hooks/useHushLayer'
import { escapeCell, isSentinelCell } from './parse'
import { getTableEdit } from './state'
import { resolveWithFallback } from './resolve'
import { cellKeymap, nestedCellTheme, tsvPasteHandler, type NestedNavFns } from './keymap'

let nestedPreviewField: Extension = []

export function setNestedPreviewField(ext: Extension): void {
  nestedPreviewField = ext
}

let nestedViewInstance: EditorView | null = null

export function activeNestedView(): EditorView | null {
  if (nestedViewInstance && nestedViewInstance.dom.isConnected) return nestedViewInstance
  nestedViewInstance = null
  return null
}

// When CM rebuilds widgets, toDOM() runs before the old widget's destroy()
// (see docview: builder.run -> destroyDropped), so pendingHandoff is not yet
// filled at that point. Track the most recently mounted nested session so a
// new widget can read the previous generation's latest text on mount;
// otherwise old and new text commit in alternation, forming a microtask death loop.
let liveNested: { key: string; view: EditorView } | null = null

export function liveNestedText(key: string): string | null {
  if (!liveNested || liveNested.key !== key) return null
  try {
    return escapeCell(liveNested.view.state.doc.toString())
  } catch {
    return null
  }
}


let pendingHandoff: { key: string; text: string } | null = null
export const handoffKey = (t: number, r: number, c: number) => `${t}:${r}:${c}`

export function getHandoff(key: string): string | null {
  if (pendingHandoff && pendingHandoff.key === key) {
    const text = pendingHandoff.text
    pendingHandoff = null
    return text
  }
  return null
}

let handoffSuppressDepth = 0

export function withHandoffSuppressed<T>(fn: () => T): T {
  handoffSuppressDepth++
  try {
    return fn()
  } finally {
    handoffSuppressDepth--
  }
}

export function shouldHandoff(
  stateActive: { row: number; col: number } | null,
  own: { row: number; col: number } | null,
  suppressed: boolean
): boolean {
  if (suppressed || !own) return false
  const isRetarget =
    stateActive != null && (stateActive.row !== own.row || stateActive.col !== own.col)
  return !isRetarget
}

export function captureHandoff(
  view: EditorView | null,
  own: { row: number; col: number } | null,
  sourceFrom: number,
  pendingText: string
): void {
  const stateActive = view ? getTableEdit(view.state).active : null
  if (!view || !own || !shouldHandoff(stateActive, own, handoffSuppressDepth > 0)) return
  const resolved = resolveWithFallback(view, sourceFrom, sourceFrom)
  const cell = resolved?.model.cells[own.row]?.[own.col]
  const key = handoffKey(sourceFrom, own.row, own.col)
  if (cell && !isSentinelCell(cell) && pendingText !== cell.text) {
    pendingHandoff = { key, text: pendingText }
  }
  commitHandoff(view, own.row, own.col, pendingText)
}

// Fuse: no residual commit asymmetry should ever hang the renderer again —
// drop and warn on too many commits within a short window
let fuseCount = 0
let fuseWindowStart = 0
let fuseWarned = false

function fuseTripped(): boolean {
  const now = Date.now()
  if (now - fuseWindowStart > 500) {
    fuseWindowStart = now
    fuseCount = 0
  }
  if (++fuseCount > 12) {
    if (!fuseWarned) {
      fuseWarned = true
      console.warn('[veloxmark] table cell commit storm detected, commits skipped')
    }
    return true
  }
  return false
}

export function commitHandoff(view: EditorView, row: number, col: number, pendingText: string): void {
  queueMicrotask(() => {
    try {
      const st = view.state
      const ed = getTableEdit(st)
      if (!ed.active) return
      if (ed.active.row !== row || ed.active.col !== col) return
      const r = resolveWithFallback(view, ed.active.tableFrom, ed.active.tableFrom)
      const c = r?.model.cells[row]?.[col]
      if (!r || !c || isSentinelCell(c)) return
      if (pendingText !== c.text) {
        if (fuseTripped()) return
        view.dispatch({
          changes: { from: c.from, to: c.to, insert: pendingText },
          userEvent: 'input.table.cell'
        })
      }
    } catch {
    }
  })
}

export function destroyHandoff(
  dom: HTMLElement,
  view: EditorView | null,
  own: { row: number; col: number } | null,
  sourceFrom: number
): void {
  const cellEl = dom.querySelector('.cm-md-table-cell-editing')
  const host = (cellEl ?? null) as HTMLElement | null
  const maybe = host ? EditorView.findFromDOM(host) : null
  if (maybe && host && host.contains(maybe.dom)) {
    const pendingText = escapeCell(maybe.state.doc.toString())
    captureHandoff(view, own, sourceFrom, pendingText)
    maybe.destroy()
    if (nestedViewInstance === maybe) nestedViewInstance = null
    // If the next-generation session is already mounted (liveNested points at the new view), do not clobber it
    if (liveNested?.view === maybe) liveNested = null
    const wv = (window as unknown as { __veloxTableCellView?: EditorView }).__veloxTableCellView
    if (wv === maybe) {
      ;(window as unknown as { __veloxTableCellView?: EditorView }).__veloxTableCellView = undefined
    }
  }
}


export function mountCellEditor(
  td: HTMLElement,
  cellText: string,
  theme: ThemeName,
  main: EditorView,
  caret: number,
  nav: NestedNavFns,
  key: string
): EditorView {
  td.classList.add('cm-md-table-cell-editing')
  td.textContent = ''
  const nested = new EditorView({
    state: EditorState.create({
      doc: cellText,
      extensions: [
        markdown({ extensions: [GFM], addKeymap: false, pasteURLAsLink: false }),
        nestedPreviewField,
        livePreviewConfigFacet.of({
          theme,
          baseDir: '',
          imageEpoch: 0,
          linkEpoch: 0,
          mode: 'live',
          focusMode: false,
          typewriterMode: false
        }),
        nestedCellTheme,
        EditorView.lineWrapping,
        history(),
        keymap.of([...cellKeymap(main, nav), ...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((u) => {
          if (!u.focusChanged || u.view.hasFocus) return
          setTimeout(() => {
            if (!main.dom.isConnected) return
            if (!getTableEdit(main.state).active) return
            if (main.hasFocus) return
            const nv = activeNestedView()
            if (nv && nv.hasFocus) return
            const wrap = u.view.dom.closest?.('.cm-md-table-wrap')
            const ae = document.activeElement
            if (wrap && ae && ae !== document.body && wrap.contains(ae)) return
            if (ae && hushLayers.isLayerTarget(ae)) return
            nav.exit(main, { select: 'none' })
          }, 0)
        }),
        tsvPasteHandler(main, nav.tsv)
      ]
    }),
    parent: td
  })
  ;(td as unknown as { __cellView?: EditorView }).__cellView = nested
  ;(window as unknown as { __veloxTableCellView?: EditorView }).__veloxTableCellView = nested
  nestedViewInstance = nested
  liveNested = { key, view: nested }
  const pos = Math.min(Math.max(caret, 0), nested.state.doc.length)
  nested.dispatch({ selection: { anchor: pos }, scrollIntoView: false })
  const tryFocus = (): void => {
    if (nested.dom.isConnected) nested.focus()
  }
  queueMicrotask(tryFocus)
  setTimeout(tryFocus, 10)
  return nested
}
