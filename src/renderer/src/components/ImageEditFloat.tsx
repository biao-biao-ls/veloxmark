import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement
} from 'react'
import { createPortal } from 'react-dom'
import { applyImageEditAtAnchor } from '../editor/imageEdit'
import { applyImageAlignDom } from '../editor/image-widget'
import { deriveWidthPct, type ImageAlign } from '../editor/image-parse'
import { hoverDiscipline, HOVER_CHANNELS } from '../hooks/useHoverDiscipline'
import { t } from '../i18n'
import { registerHoverContent } from './RenderFloat'

const CHANNEL = HOVER_CHANNELS.imageFloat

const WIDTH_PRESETS = [25, 50, 75, 100, 150, 200]

const MIN_DRAG_PX = 16

function imgOf(anchor: HTMLElement): HTMLImageElement | null {
  return anchor.querySelector('img.cm-md-image')
}

function deriveAlign(anchor: HTMLElement): ImageAlign {
  if (anchor.classList.contains('cm-md-image-align-center')) return 'center'
  if (anchor.classList.contains('cm-md-image-align-right')) return 'right'
  return 'left'
}

function widthPctOfAnchor(anchor: HTMLElement): number {
  const img = imgOf(anchor)
  return img ? deriveWidthPct(img.style.width, img.naturalWidth) : 100
}

function widthOptions(current: number): number[] {
  return [...new Set([...WIDTH_PRESETS, current])].sort((a, b) => a - b)
}

interface SavedImgStyle {
  width: string
  height: string
  maxWidth: string
}

function snapshotImgStyle(img: HTMLImageElement): SavedImgStyle {
  return { width: img.style.width, height: img.style.height, maxWidth: img.style.maxWidth }
}

function restoreImgStyle(img: HTMLImageElement, saved: SavedImgStyle): void {
  img.style.width = saved.width
  img.style.height = saved.height
  img.style.maxWidth = saved.maxWidth
}

function ResizeHandle({ anchor }: { anchor: HTMLElement }) {
  const sessionRef = useRef<{ abort: () => void } | null>(null)

  useEffect(() => () => sessionRef.current?.abort(), [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
    const img = imgOf(anchor)
    if (!img) return

    const saved = snapshotImgStyle(img)
    const startW = img.clientWidth || img.naturalWidth
    const startH = img.clientHeight || img.naturalHeight
    const aspect =
      img.naturalWidth && img.naturalHeight
        ? img.naturalWidth / img.naturalHeight
        : startW / Math.max(startH, 1)
    const startX = e.clientX
    const startY = e.clientY

    hoverDiscipline.pin(CHANNEL)

    let finished = false
    const detach = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', onUp)
      hoverDiscipline.unpin(CHANNEL)
    }

    const onMove = (ev: PointerEvent): void => {
      const delta =
        Math.abs(ev.clientX - startX) > Math.abs(ev.clientY - startY)
          ? ev.clientX - startX
          : ev.clientY - startY
      const w = Math.max(MIN_DRAG_PX, Math.round(startW + delta))
      const h = Math.max(MIN_DRAG_PX, Math.round(w / aspect))
      img.style.width = `${w}px`
      img.style.height = `${h}px`
      img.style.maxWidth = 'none'
    }

    const onUp = (): void => {
      if (finished) return
      finished = true
      sessionRef.current = null
      detach()
      const w = Number.parseFloat(img.style.width)
      const h = Number.parseFloat(img.style.height)
      if (!Number.isFinite(w) || !Number.isFinite(h)) {
        restoreImgStyle(img, saved)
        return
      }
      void applyImageEditAtAnchor(anchor, { width: w, height: h }, 'size').then((ok) => {
        if (!ok) restoreImgStyle(img, saved)
      })
    }

    const abort = (): void => {
      if (finished) return
      finished = true
      sessionRef.current = null
      detach()
      restoreImgStyle(img, saved)
    }

    sessionRef.current = { abort }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onUp)
  }

  return (
    <div
      className="cm-md-img-resize"
      data-testid="image-resize-handle"
      title={t('render.image.resizeTitle')}
      aria-label={t('render.image.resizeTitle')}
      onPointerDown={onPointerDown}
    />
  )
}

function ImageEditFloat({ anchor }: { anchor: HTMLElement }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [align, setAlign] = useState<ImageAlign>(() => deriveAlign(anchor))
  const [widthPct, setWidthPct] = useState<number>(() => widthPctOfAnchor(anchor))

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

  const commitAlign = (next: ImageAlign): void => {
    if (next === align) return
    void applyImageEditAtAnchor(anchor, { align: next }, 'align').then((ok) => {
      if (!ok) {
        setAlign(deriveAlign(anchor))
        return
      }
      applyImageAlignDom(anchor, next)
      setAlign(next)
    })
  }

  const commitWidth = (pct: number): void => {
    const img = imgOf(anchor)
    if (!img) return
    const nw = img.naturalWidth
    const nh = img.naturalHeight
    if (!nw || !nh) return
    const w = Math.max(1, Math.round((nw * pct) / 100))
    const h = Math.max(1, Math.round((nh * pct) / 100))
    void applyImageEditAtAnchor(anchor, { width: w, height: h }, 'size').then((ok) => {
      if (ok) {
        img.style.width = `${w}px`
        img.style.height = `${h}px`
        img.style.maxWidth = 'none'
      }
      setWidthPct(widthPctOfAnchor(anchor))
    })
  }

  const alignButton = (value: ImageAlign, glyph: string, label: string): ReactElement => (
    <button
      type="button"
      className={align === value ? 'cm-md-float-btn is-on' : 'cm-md-float-btn'}
      data-testid={`image-align-${value}`}
      title={label}
      aria-label={label}
      aria-pressed={align === value}
      onClick={() => commitAlign(value)}
    >
      {glyph}
    </button>
  )

  return (
    <>
      <div className="cm-md-float cm-md-img-toolbar" data-testid="image-edit-float" ref={rootRef}>
        {alignButton('left', '◧', t('render.image.alignLeftTitle'))}
        {alignButton('center', '▣', t('render.image.alignCenterTitle'))}
        {alignButton('right', '◨', t('render.image.alignRightTitle'))}
        <span className="cm-md-float-sep" aria-hidden="true" />
        <label
          className="cm-md-float-select"
          data-testid="image-width-select"
          title={t('render.image.widthTitle')}
        >
          <span>{t('render.image.width')}</span>
          <select
            value={widthPct}
            aria-label={t('render.image.widthTitle')}
            onChange={(e) => commitWidth(Number(e.target.value))}
          >
            {widthOptions(widthPct).map((pct) => (
              <option key={pct} value={pct}>
                {pct}%
              </option>
            ))}
          </select>
          <span className="cm-md-float-caret" aria-hidden="true">
            ▾
          </span>
        </label>
        <span className="cm-md-float-sep" aria-hidden="true" />
        <button
          type="button"
          className="cm-md-float-primary"
          data-testid="image-edit-done"
          title={t('render.image.doneTitle')}
          onClick={() => hoverDiscipline.hideNow(CHANNEL)}
        >
          <span aria-hidden="true">✓</span>
          <span>{t('render.image.done')}</span>
        </button>
      </div>
      {createPortal(<ResizeHandle anchor={anchor} />, anchor)}
    </>
  )
}

registerHoverContent(CHANNEL, (anchor) => <ImageEditFloat anchor={anchor} />)
