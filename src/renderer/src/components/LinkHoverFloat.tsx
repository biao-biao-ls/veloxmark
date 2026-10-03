/**
 * IT-03 FE-05 — 链接悬停浮层 (ren-link:hover-float, ui_06 block B)。
 *
 * Structure per ui_06 block B / FE-05「页面元素」table:
 *   .cm-md-float.cm-md-link-pop   row shell (RenderFloat places it under the link)
 *     display mode:
 *       .cm-md-link-url          full-URL box (title = full URL, ellipsis)
 *       .cm-md-float-btn ×3      ✎ 编辑 URL (.is-primary) / ↗ 外开 / ⧉ 复制
 *                                (column layout — icon over label, CSS-driven)
 *     edit mode (「编辑 URL」态 replaces the row):
 *       .cm-md-float-input       URL input (prefilled, Enter = confirm)
 *       .cm-md-float-btn ×2      确认 / 取消
 *
 * Show/hide is owned entirely by the FE-03 hoverDiscipline bus: this module
 * registers its content via registerHoverContent and only calls bus APIs
 * (hideNow / pin / unpin). No self-written setTimeout, no second RenderFloatHost,
 * no document-level keyboard listeners (linkNav keyboard no-regression — Esc is
 * the host's global hideAllNow).
 *
 * Every write goes through editor/linkEdit.applyLinkEditAtAnchor — the single
 * read-only gate (AC-ERR-08) and single-dispatch undo boundary. Display state
 * is re-derived from the syntax tree via hrefAtAnchor at each action (stale-
 * widget discipline), falling back to the component state snapshot.
 *
 * Retarget guard (code-review P1): RenderFloatHost reuses this instance across
 * row-sweep retargets (same channel, new anchor prop, no key), so the edit
 * session must never outlive its anchor — linkFloatSession binds the session to
 * one anchor identity; on anchor change the session is rebuilt (href refreshed
 * from the new anchor, edit/draft dropped) and canConfirmEdit refuses any write
 * from a session bound elsewhere (wrong-link write-back).
 */
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { getCtxRuntime } from '../editor/contextMenu/registry'
import { applyLinkEditAtAnchor, hrefAtAnchor, isValidLinkHref } from '../editor/linkEdit'
import { HOVER_CHANNELS, hoverDiscipline } from '../hooks/useHoverDiscipline'
import { t } from '../i18n'
import { dialog } from './Dialog'
import {
  beginEdit,
  bindSession,
  canConfirmEdit,
  exitEdit,
  updateDraft,
  type LinkFloatSession
} from './linkFloatSession'
import { registerHoverContent } from './RenderFloat'

const CHANNEL = HOVER_CHANNELS.linkFloat

/** Live href re-derived from the syntax tree; state is only the fallback. */
function liveHref(anchor: HTMLElement, fallback: string): string {
  return hrefAtAnchor(anchor) ?? fallback
}

function LinkHoverFloat({ anchor }: { anchor: HTMLElement }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [session, setSession] = useState<LinkFloatSession<HTMLElement>>(() =>
    bindSession(anchor, hrefAtAnchor(anchor) ?? '')
  )

  // Retarget guard: anchor identity change = a different link is targeted.
  // Rebuild the session so the url-box shows the new anchor's href and any
  // edit session (draft/pin) from the previous anchor dies here.
  useEffect(() => {
    setSession(bindSession(anchor, hrefAtAnchor(anchor) ?? ''))
  }, [anchor])

  // Click-outside exit (「点浮层外部区域」) — bus-owned hide, no local timer.
  useEffect(() => {
    const onDown = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target)) return
      if (anchor.contains(target)) return
      hoverDiscipline.hideNow(CHANNEL)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [anchor])

  // Edit session = pin window (FE-03 contract): hide is frozen while editing
  // and resumes on exit or unmount (Esc → hideAllNow unmounts us).
  useEffect(() => {
    if (!session.editing) return
    hoverDiscipline.pin(CHANNEL)
    return () => hoverDiscipline.unpin(CHANNEL)
  }, [session.editing])

  const startEdit = (): void => {
    setSession(beginEdit(session, anchor, liveHref(anchor, session.href)))
  }

  const cancelEdit = (): void => setSession(exitEdit(session))

  const openUrl = (): void => {
    const url = liveHref(anchor, session.href)
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      // Keyed copy — the dialog resolves t() at render (App P17-F5 path).
      void dialog.alert({ messageKey: 'link.otherProtocol' })
      return
    }
    // Routes through the existing external-open channel (confirm pref + e2e
    // seam) — never window.api.openExternal directly.
    getCtxRuntime()?.openLink(url)
  }

  const copyUrl = (): void => {
    const url = liveHref(anchor, session.href)
    if (!url) return
    const rt = getCtxRuntime()
    if (!rt) return
    void rt.clipboardWrite(url).then(() => rt.toast(t('toast.copiedLink')))
  }

  const confirmEdit = (): void => {
    // Retarget gate: refuse writes from a session bound to a different anchor
    // (closes the window before the guard effect rebuilds the session).
    if (!canConfirmEdit(session, anchor)) return
    const next = session.draft.trim()
    const current = liveHref(anchor, session.href)
    if (!isValidLinkHref(next)) return // silent refusal — stay in edit mode
    if (next === current) {
      setSession(exitEdit(session))
      return
    }
    void applyLinkEditAtAnchor(anchor, next).then((ok: boolean) => {
      // Refused (read-only gate / unresolvable node) — stay in edit mode; the
      // gate already fired its toast. Success: re-derive, then restore display
      // — but only if the session is still bound to this anchor (no retarget
      // while the write was in flight).
      if (!ok) return
      setSession((s) =>
        s.anchor === anchor ? { ...exitEdit(s), href: hrefAtAnchor(anchor) ?? next } : s
      )
    })
  }

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmEdit()
    }
  }

  return (
    <div className="cm-md-float cm-md-link-pop" data-testid="link-hover-float" ref={rootRef}>
      {session.editing ? (
        <>
          <input
            className="cm-md-float-input"
            data-testid="link-url-input"
            value={session.draft}
            placeholder={t('render.link.urlPlaceholder')}
            autoFocus
            onChange={(e) => setSession((s) => updateDraft(s, e.target.value))}
            onKeyDown={onInputKeyDown}
          />
          <button
            type="button"
            className="cm-md-float-btn is-primary"
            data-testid="link-url-confirm-btn"
            onClick={confirmEdit}
          >
            <span>{t('render.link.confirm')}</span>
          </button>
          <button
            type="button"
            className="cm-md-float-btn"
            data-testid="link-url-cancel-btn"
            onClick={cancelEdit}
          >
            <span>{t('render.link.cancel')}</span>
          </button>
        </>
      ) : (
        <>
          <div className="cm-md-link-url" data-testid="link-url-box" title={session.href}>
            {session.href}
          </div>
          <button
            type="button"
            className="cm-md-float-btn is-primary"
            data-testid="link-edit-url-btn"
            title={t('render.link.editUrlTitle')}
            aria-label={t('render.link.editUrlTitle')}
            onClick={startEdit}
          >
            <span className="cm-md-pop-ico" aria-hidden="true">
              ✎
            </span>
            <span>{t('render.link.editUrl')}</span>
          </button>
          <button
            type="button"
            className="cm-md-float-btn"
            data-testid="link-open-btn"
            title={t('render.link.openTitle')}
            aria-label={t('render.link.openTitle')}
            disabled={session.href === ''}
            onClick={openUrl}
          >
            <span className="cm-md-pop-ico" aria-hidden="true">
              ↗
            </span>
            <span>{t('render.link.open')}</span>
          </button>
          <button
            type="button"
            className="cm-md-float-btn"
            data-testid="link-copy-btn"
            title={t('render.link.copyTitle')}
            aria-label={t('render.link.copyTitle')}
            disabled={session.href === ''}
            onClick={copyUrl}
          >
            <span className="cm-md-pop-ico" aria-hidden="true">
              ⧉
            </span>
            <span>{t('render.link.copy')}</span>
          </button>
        </>
      )}
    </div>
  )
}

// FE-05 registration: one content source for the link float channel. The
// host (FE-03) owns mounting; this side effect only fills the slot.
registerHoverContent(CHANNEL, (anchor) => <LinkHoverFloat anchor={anchor} />)
