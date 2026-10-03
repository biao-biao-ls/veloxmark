/**
 * IT-03 FE-04 — 图片编辑浮层 (ren-image:edit-float)。
 *
 * Structure per ui_06 block A / FE-04「页面元素」table:
 *   .cm-md-float            toolbar shell (RenderFloat places it under the image)
 *     .cm-md-float-btn ×3   ◧ 左对齐 / ▣ 居中 / ◨ 右对齐  (.is-on = current)
 *     .cm-md-float-sep
 *     .cm-md-float-select   「宽度 N%」+ caret
 *     .cm-md-float-sep
 *     .cm-md-float-primary  ✓ 完成
 *   .cm-md-img-resize       corner grip, portaled into the anchor wrap
 *
 * Show/hide is owned entirely by the FE-03 hoverDiscipline bus: this module
 * registers its content via registerHoverContent and only calls bus APIs
 * (hideNow / pin / unpin). No self-written setTimeout, no second RenderFloatHost.
 *
 * Every write goes through editor/imageEdit.applyImageEditAtAnchor — the single
 * read-only gate (AC-ERR-08) and single-dispatch undo boundary (AC-OP-13).
 * Display state is derived from the rendered DOM after each op, never from a
 * captured spec: ImageWidget.eq() deliberately reuses the DOM across write-backs
 * so the element is the live truth (same stale-widget discipline as the P05
 * zoom toolbar's derivePct).
 */
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

/** Width presets for the dropdown (P05 zoom slider spans 25%–400%). */
const WIDTH_PRESETS = [25, 50, 75, 100, 150, 200]

/** Drag floor — an image smaller than this is unusable and un-clickable. */
const MIN_DRAG_PX = 16

function imgOf(anchor: HTMLElement): HTMLImageElement | null {
  return anchor.querySelector('img.cm-md-image')
}

function deriveAlign(anchor: HTMLElement): ImageAlign {
  if (anchor.classList.contains('cm-md-image-align-center')) return 'center'
  if (anchor.classList.contains('cm-md-image-align-right')) return 'right'
  return 'left'
}

/**
 * DOM adapter over image-parse's pure deriveWidthPct. The float has no source
 * slot, so a missing style.width falls to 100 — safe because the widget always
 * paints `=WxH` into style.width first (the adapter only lacks spec.width).
 */
function widthPctOfAnchor(anchor: HTMLElement): number {
  const img = imgOf(anchor)
  return img ? deriveWidthPct(img.style.width, img.naturalWidth) : 100
}

/** Presets plus the live value (a drag can land on any percentage). */
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

/**
 * Bottom-right grip. Portaled into the image wrap so it sits on the image
 * corner without disturbing the float's fixed positioning, and unmounts with
 * the float — hover-only rendering, zero residue (UI-IXD-10).
 */
function ResizeHandle({ anchor }: { anchor: HTMLElement }) {
  // Live drag session (if any). Survives outside React state on purpose: the
  // session's window listeners outlive renders, and the unmount cleanup below
  // must reach them (Esc → hideAllNow teardown mid-drag).
  const sessionRef = useRef<{ abort: () => void } | null>(null)

  // Float torn down mid-drag (Esc → hideAllNow, host hide, channel switch):
  // abort the session, restore the pre-drag style and NEVER write back — the
  // ListDragHandle Esc-cancel discipline.
  useEffect(() => () => sessionRef.current?.abort(), [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    // Keep CM from moving the cursor into the source (revealing it) and from
    // starting a text selection during the drag.
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

    // Pin first: pointer release over a non-image area must not schedule a
    // hide mid-session (FE-03 drag-session contract).
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
      // nwse grip — drag right/down grows. The dominant axis drives the width
      // so the natural aspect ratio is preserved exactly (Typora behaviour).
      const delta =
        Math.abs(ev.clientX - startX) > Math.abs(ev.clientY - startY)
          ? ev.clientX - startX
          : ev.clientY - startY
      const w = Math.max(MIN_DRAG_PX, Math.round(startW + delta))
      const h = Math.max(MIN_DRAG_PX, Math.round(w / aspect))
      img.style.width = `${w}px`
      img.style.height = `${h}px`
      // Explicit sizes win over the layout clamp — an upscale past the
      // container width must stay visible (matches ImageWidget.toDOM).
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
        // Refused (read-only gate / unresolvable node) — snap the preview back
        // so the render never disagrees with the source. On success the preview
        // already matches the bytes just written.
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
    // Interrupted grabs (pointercancel / window blur) settle through the same
    // finish path as a normal release — the preview already carries the size.
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
  // Initial state comes from the rendered DOM (widget DOM may predate spec).
  const [align, setAlign] = useState<ImageAlign>(() => deriveAlign(anchor))
  const [widthPct, setWidthPct] = useState<number>(() => widthPctOfAnchor(anchor))

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

  const commitAlign = (next: ImageAlign): void => {
    if (next === align) return // already active — never mutate the doc for a no-op
    void applyImageEditAtAnchor(anchor, { align: next }, 'align').then((ok) => {
      // eq() skips align so toDOM never re-runs for this write — the anchor's
      // classes stay stale unless we push them here. On refusal nothing was
      // written, so the unchanged DOM is the truth and we only re-sync state.
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
    if (!nw || !nh) return // not loaded yet — nothing authoritative to write
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

// FE-04 registration: one content source for the image float channel. The
// host (FE-03) owns mounting; this side effect only fills the slot.
registerHoverContent(CHANNEL, (anchor) => <ImageEditFloat anchor={anchor} />)
