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

function liveHref(anchor: HTMLElement, fallback: string): string {
  return hrefAtAnchor(anchor) ?? fallback
}

function LinkHoverFloat({ anchor }: { anchor: HTMLElement }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [session, setSession] = useState<LinkFloatSession<HTMLElement>>(() =>
    bindSession(anchor, hrefAtAnchor(anchor) ?? '')
  )

  useEffect(() => {
    setSession(bindSession(anchor, hrefAtAnchor(anchor) ?? ''))
  }, [anchor])

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
      void dialog.alert({ messageKey: 'link.otherProtocol' })
      return
    }
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
    if (!canConfirmEdit(session, anchor)) return
    const next = session.draft.trim()
    const current = liveHref(anchor, session.href)
    if (!isValidLinkHref(next)) return
    if (next === current) {
      setSession(exitEdit(session))
      return
    }
    void applyLinkEditAtAnchor(anchor, next).then((ok: boolean) => {
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

registerHoverContent(CHANNEL, (anchor) => <LinkHoverFloat anchor={anchor} />)
