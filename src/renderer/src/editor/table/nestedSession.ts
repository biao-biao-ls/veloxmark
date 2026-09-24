/**
 * Nested cell-editor session (task 3.7) — the UX-P28 handoff protocol and
 * mount/teardown of the in-cell CodeMirror view. Bodies moved verbatim from
 * table/widget.ts.
 *
 * Handoff protocol (UX-P28 D1, correctness-critical) — both ends live here
 * and MUST NOT be split apart:
 *   - destroy end: `destroyHandoff` captures pending text BEFORE destroying
 *     the nested view, stashes it one-shot keyed by `handoffKey`, then
 *     schedules `commitHandoff` (microtask write-back).
 *   - mount end: `getHandoff` consumes the stash (one-shot) and
 *     `mountCellEditor` seeds the new nested view with the text.
 * Without this, a race of destroy→toDOM→microtask-commit would clobber the
 * pending text with stale committed source.
 *
 * Non-verbatim points (structural, behavior-identical):
 * - command callbacks (move/exit/tsv) enter via `NestedNavFns` — the
 *   keymap/commands cycle-break seam (see keymap.ts header).
 * - `own` is typed `{ row; col } | null` (only the fields destroy reads)
 *   instead of TableWidgetActive, to keep this module free of widget imports.
 */
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { GFM } from '@lezer/markdown'
import type { ThemeName } from '../theme'
import { livePreviewConfigFacet } from '../livePreview/config'
import { escapeCell, isSentinelCell } from './parse'
import { getTableEdit } from './state'
import { resolveWithFallback } from './resolve'
import { cellKeymap, nestedCellTheme, tsvPasteHandler, type NestedNavFns } from './keymap'

/**
 * Injection seam (task 1D): the live-preview StateField mounted by nested
 * cell editors. `editor/setup.ts` wires it at assembly time via
 * `setNestedPreviewField` — importing `../livePreview/field` directly here
 * would close the build → handlers → table/widget → field import cycle
 * (docs/specs/1D-split-handlers/spec.md). Defaults to `[]` (CM6 no-op) so
 * a never-wired unit-test host degrades to "no nested live preview" instead
 * of crashing.
 */
let nestedPreviewField: Extension = []

export function setNestedPreviewField(ext: Extension): void {
  nestedPreviewField = ext
}

/** The live nested view of the active cell (module-level: widgets are ephemeral). */
let nestedViewInstance: EditorView | null = null

/** Exported for lifecycle.ts self-heal focus (widgets are ephemeral). */
export function activeNestedView(): EditorView | null {
  if (nestedViewInstance && nestedViewInstance.dom.isConnected) return nestedViewInstance
  nestedViewInstance = null
  return null
}

// ---- UX-P28: pending text handoff (correctness-critical) ---------------------

/**
 * When a widget is destroyed due to a rebuild (theme/colWidths/i18n change),
 * the pending nested text must survive the remount cycle. destroy() captures
 * the pending text into this handoff; mountCellEditor consumes it to seed the
 * new nested view. Without this, a race of destroy→toDOM→microtask-commit
 * would clobber the pending text with stale committed source.
 *
 * Handoff is one-shot: destroy sets it, mountCellEditor consumes and clears.
 */
let pendingHandoff: { key: string; text: string } | null = null
export const handoffKey = (t: number, r: number, c: number) => `${t}:${r}:${c}`

/** Mount end: one-shot consume of the stashed pending text for `key`. */
export function getHandoff(key: string): string | null {
  if (pendingHandoff && pendingHandoff.key === key) {
    const text = pendingHandoff.text
    pendingHandoff = null
    return text
  }
  return null
}

/**
 * Destroy end part 2: microtask write-back of the pending text. Runs after
 * the CM6 update task completes. Commits pending text without clearing active
 * (rebuild preserves session). Guarded: the view may be destroyed, and only
 * an active cell still matching the capture is committed.
 */
export function commitHandoff(view: EditorView, row: number, col: number, pendingText: string): void {
  queueMicrotask(() => {
    try {
      const st = view.state
      const ed = getTableEdit(st)
      if (!ed.active) return // Already cleared (product exit path).
      // Only commit if the active cell still matches what we captured.
      if (ed.active.row !== row || ed.active.col !== col) return
      const r = resolveWithFallback(view, ed.active.tableFrom, ed.active.tableFrom)
      const c = r?.model.cells[row]?.[col]
      if (!r || !c || isSentinelCell(c)) return
      if (pendingText !== c.text) {
        view.dispatch({
          changes: { from: c.from, to: c.to, insert: pendingText },
          userEvent: 'input.table.cell'
        })
      }
    } catch {
      // View may be destroyed; no-op.
    }
  })
}

/**
 * Destroy end (whole of the old TableWidget.destroy body): capture pending
 * text, stash the handoff, schedule the microtask commit, then tear the
 * nested view down and clear session seams.
 */
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
    // UX-P28 D1: capture pending text BEFORE destroying the nested view.
    // The handoff ensures the next mount (after rebuild) seeds with this
    // text instead of the stale committed source — preventing the
    // destroy→remount→commit→destroy→"old overwrites PRECIOUS" clobber.
    //
    // diag-P28: the handoff identity MUST be this widget's own active cell
    // (spec.active + sourceFrom). Reading getTableEdit(view.state).active
    // instead would point at the NEW cell on hops (state already moved)
    // while `maybe` still holds the OLD cell's text — the handoff then
    // seeds the hop TARGET with the source cell's text and the microtask
    // clobbers the target's source with it.
    const pendingText = escapeCell(maybe.state.doc.toString())
    const stateActive = view ? getTableEdit(view.state).active : null
    // Hop (or re-target): activateCellAt/runTableOp already committed this
    // cell's pending text in the same transaction and the new mount owns
    // the session — skip handoff + microtask entirely.
    const isRetarget =
      stateActive != null &&
      (stateActive.row !== own?.row || stateActive.col !== own?.col)
    if (view && own && !isRetarget) {
      const resolved = resolveWithFallback(view, sourceFrom, sourceFrom)
      const cell = resolved?.model.cells[own.row]?.[own.col]
      const key = handoffKey(sourceFrom, own.row, own.col)
      // Only set handoff if pending differs from committed source.
      if (cell && !isSentinelCell(cell) && pendingText !== cell.text) {
        pendingHandoff = { key, text: pendingText }
      }
      // Microtask commit: runs after the CM6 update task completes.
      // Commits pending text without clearing active (rebuild preserves session).
      commitHandoff(view, own.row, own.col, pendingText)
    }
    maybe.destroy()
    if (nestedViewInstance === maybe) nestedViewInstance = null
    const wv = (window as unknown as { __veloxTableCellView?: EditorView }).__veloxTableCellView
    if (wv === maybe) {
      ;(window as unknown as { __veloxTableCellView?: EditorView }).__veloxTableCellView = undefined
    }
  }
}

// ---- nested view mount -------------------------------------------------------

export function mountCellEditor(
  td: HTMLElement,
  cellText: string,
  theme: ThemeName,
  main: EditorView,
  caret: number,
  nav: NestedNavFns
): EditorView {
  td.classList.add('cm-md-table-cell-editing')
  td.textContent = ''
  const nested = new EditorView({
    state: EditorState.create({
      doc: cellText,
      extensions: [
        markdown({ extensions: [GFM], addKeymap: false, pasteURLAsLink: false }),
        // P09 live-preview rules inside the cell — same decoration pipeline
        // (injected via setNestedPreviewField — see top of file).
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
        // diag-P28 B1-gap: selection-leave auto-exit only fires on MAIN-editor
        // selection changes. Clicks outside the editor (panels, other apps)
        // blur the nested view without touching main selection — exit there
        // too ("失焦即退场"). Deferred so a click that re-enters another cell
        // (or a table handle) can restore focus first and cancel the exit.
        EditorView.updateListener.of((u) => {
          if (!u.focusChanged || u.view.hasFocus) return
          setTimeout(() => {
            // CM6 has no public isDestroyed (destroyed is a private field);
            // a destroyed view's dom is detached from the document.
            if (!main.dom.isConnected) return
            if (!getTableEdit(main.state).active) return
            if (main.hasFocus) return
            const nv = activeNestedView()
            if (nv && nv.hasFocus) return
            const wrap = u.view.dom.closest?.('.cm-md-table-wrap')
            const ae = document.activeElement
            if (wrap && ae && ae !== document.body && wrap.contains(ae)) return
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
  const pos = Math.min(Math.max(caret, 0), nested.state.doc.length)
  nested.dispatch({ selection: { anchor: pos }, scrollIntoView: false })
  // UX-P28 F1 / diag-P28: defer focus until after CM6 inserts the widget DOM
  // into the document (toDOM runs before insertion, so sync focus() is a
  // silent no-op on a detached node). Multi-shot: microtask covers the common
  // case (same task, right after DOM sync); the timeout backstops remount
  // chains. tableEditLifecycle's self-heal listener covers any remaining gap.
  const tryFocus = (): void => {
    if (nested.dom.isConnected) nested.focus()
  }
  queueMicrotask(tryFocus)
  setTimeout(tryFocus, 10)
  return nested
}
