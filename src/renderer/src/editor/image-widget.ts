import { syntaxTree } from '@codemirror/language'
import { EditorView, WidgetType } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { t } from '../i18n'
import { attachWidgetContextMenu } from './contextMenu/widgetEntry'
import { flipTransform, IMAGE_MARKDOWN_RE, type ParsedImage } from './image-parse'

// ---- images (P05) ------------------------------------------------------------
// (2.4: resolution cache, rewriteImageNode and ImageWidget moved verbatim from
// editor/widgets.ts.) ParsedImage / parseImageMarkdown / flipTransform moved to
// image-parse.ts (2.2) — imported above.

interface CachedImage {
  src: string
  mtime: number | null
  absPath: string | null
}

/**
 * Resolution cache, keyed by baseDir + markdown src. Entries survive widget
 * recreations; invalidateImageCache() clears them (watcher / focus paths).
 */
const imageCache = new Map<string, CachedImage>()

/** Close every open image zoom toolbar (only one image is selected at a time). */
export function closeAllImageSelections(): void {
  for (const el of document.querySelectorAll('.cm-md-image-wrap.cm-md-image-selected')) {
    el.classList.remove('cm-md-image-selected')
    el.querySelector('.cm-md-image-toolbar')?.remove()
  }
}

/**
 * Drop all cached image resolutions. The next decoration rebuild re-resolves
 * every src (mtime-aware, with a cache-busting `v=` param) — wired to the
 * folder watcher's `image:changed` broadcast and window-focus revalidation.
 */
export function invalidateImageCache(): void {
  imageCache.clear()
}

/**
 * Rewrite the image node containing `sourceFrom` with new size/flip
 * attributes (null clears them). Re-resolves the node through the syntax
 * tree so the write-back survives intermediate edits.
 */
function rewriteImageNode(
  view: EditorView,
  sourceFrom: number,
  next: { width?: number | null; height?: number | null; flip?: string | null }
): void {
  const state = view.state
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(sourceFrom, 1)
  while (node && node.name !== 'Image') node = node.parent
  if (!node) return
  const m = IMAGE_MARKDOWN_RE.exec(state.sliceDoc(node.from, node.to))
  if (!m) return
  const [, alt, src, title] = m
  const width = next.width !== undefined ? next.width : m[4] ? Number(m[4]) : null
  const height = next.height !== undefined ? next.height : m[5] ? Number(m[5]) : null
  const flip = next.flip !== undefined ? next.flip || null : m[6] || null
  const titlePart = title != null ? ` "${title}"` : ''
  const sizePart = width != null && height != null ? ` =${width}x${height}` : ''
  const flipPart = flip ? `{flip=${flip}}` : ''
  const insert = `![${alt}](${src}${titlePart}${sizePart})${flipPart}`
  view.dispatch({
    changes: { from: node.from, to: node.to, insert },
    userEvent: 'input.image.resize'
  })
}

export class ImageWidget extends WidgetType {
  constructor(
    readonly spec: ParsedImage,
    readonly baseDir: string,
    /** Source range of the ![…](…) node — anchor for size write-backs. */
    readonly sourceFrom: number,
    readonly sourceTo: number,
    /**
     * LivePreviewConfig.imageEpoch — part of identity so a cache invalidation
     * (watcher / focus) recreates the DOM and re-resolves the src. Without
     * this, CM's eq()-based DOM reuse would keep showing the stale image.
     */
    readonly epoch: number = 0,
    /** wave④: i18n epoch — toolbar titles refresh on language switch. */
    readonly i18nEpoch: number = 0
  ) {
    super()
  }

  /**
   * Width/height intentionally NOT compared: the slider commits a source edit
   * which rebuilds the widget, and keeping the DOM (toolbar open, style
   * already applied live) is the better UX. Size changes made in source mode
   * still land because those edits move the node and force a recreate.
   */
  eq(other: ImageWidget): boolean {
    return (
      other.spec.src === this.spec.src &&
      other.spec.alt === this.spec.alt &&
      other.baseDir === this.baseDir &&
      other.sourceFrom === this.sourceFrom &&
      other.epoch === this.epoch &&
      (other.i18nEpoch ?? 0) === (this.i18nEpoch ?? 0)
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'cm-md-image-wrap'

    const img = document.createElement('img')
    img.className = 'cm-md-image'
    img.alt = this.spec.alt
    img.draggable = false
    if (this.spec.width) {
      img.style.width = `${this.spec.width}px`
      if (this.spec.height) img.style.height = `${this.spec.height}px`
      // Explicit sizes win over the layout clamp — an upscale past the
      // container width must stay visible (matches Typora).
      img.style.maxWidth = 'none'
    }
    if (this.spec.flip) img.style.transform = flipTransform(this.spec.flip)
    wrap.appendChild(img)

    // Broken/missing image: placeholder with the alt text, never a blank hole.
    img.addEventListener('error', () => {
      if (!img.getAttribute('src') || wrap.classList.contains('cm-md-image-broken')) return
      wrap.classList.add('cm-md-image-broken')
      const ph = document.createElement('span')
      ph.className = 'cm-md-image-placeholder'
      ph.textContent = this.spec.alt || t('image.notFound')
      wrap.appendChild(ph)
      img.remove()
    })

    this.mountResolvedSrc(img)
    this.mountSelection(wrap, img, view)
    // P05 GAP: image right-click → unified menu (skeleton + openLink deltas;
    // image-specific ops land with UX-P05's delta factory).
    attachWidgetContextMenu(wrap, view, this.sourceFrom)
    return wrap
  }

  private cacheKey(): string {
    return `${this.baseDir}\n${this.spec.src}`
  }

  private mountResolvedSrc(img: HTMLImageElement): void {
    const key = this.cacheKey()
    const cached = imageCache.get(key)
    if (cached) {
      img.src = cached.src
      return
    }
    void window.api.resolveImageSrc(this.baseDir, this.spec.src).then((resolved) => {
      imageCache.set(key, resolved)
      img.src = resolved.src
    })
  }

  /** Click-to-select: open the zoom toolbar without collapsing to source. */
  private mountSelection(wrap: HTMLElement, img: HTMLImageElement, view: EditorView): void {
    img.addEventListener('mousedown', (e) => {
      // Keep CM from moving the cursor into the source (which would reveal it).
      e.preventDefault()
      e.stopPropagation()
    })
    img.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (wrap.classList.contains('cm-md-image-selected')) return
      closeAllImageSelections()
      wrap.classList.add('cm-md-image-selected')
      wrap.appendChild(this.buildToolbar(img, view))
    })
  }

  private buildToolbar(img: HTMLImageElement, view: EditorView): HTMLElement {
    const toolbar = document.createElement('div')
    toolbar.className = 'cm-md-image-toolbar'
    // Keep events from reaching CM (cursor move / deselect) but NEVER
    // preventDefault on form controls: cancelling mousedown's default action
    // kills the range input's native thumb drag (buttons survive because they
    // fire on click, which is why only the slider felt broken).
    toolbar.addEventListener('mousedown', (e) => {
      e.stopPropagation()
      const t = e.target
      if (!(t instanceof Element && t.closest('input, button, select, textarea'))) {
        e.preventDefault()
      }
    })
    toolbar.addEventListener('click', (e) => e.stopPropagation())

    // Zoom sliders read better on a log scale: the thumb travels multiplicatively,
    // so 100% (original size) sits at the center of the track and each equal
    // step is an equal ratio, not an equal pixel delta. Track position 0-100
    // maps to 25%-400% via pos = 100·log4(pct/25)  ⇔  pct = 25·16^(pos/100).
    const PCT_MIN = 25
    const PCT_MAX = 400
    const RATIO = PCT_MAX / PCT_MIN // 16
    const posToPct = (pos: number): number =>
      Math.min(PCT_MAX, Math.max(PCT_MIN, Math.round(PCT_MIN * Math.pow(RATIO, pos / 100))))
    const pctToPos = (pct: number): number =>
      Math.min(
        100,
        Math.max(0, Math.round((100 * Math.log(pct / PCT_MIN)) / Math.log(RATIO)))
      )

    const pctOf = (w?: number): number =>
      img.naturalWidth && w ? Math.round((w / img.naturalWidth) * 100) : 100
    // The toolbar may be built from a STALE widget instance: eq() reuses this
    // DOM (and its listeners) across size/flip commits, so `this.spec` can
    // predate the latest source rewrite. The rendered element always carries
    // the committed state (applyStyle / flip toggles write it live), so derive
    // from it — reading spec here would reset a resized image to 100% on
    // re-select.
    const derivePct = (): number => {
      const nw = img.naturalWidth
      if (nw && img.style.width) {
        const w = Number.parseFloat(img.style.width)
        if (Number.isFinite(w) && w > 0) return Math.round((w / nw) * 100)
      }
      return pctOf(this.spec.width)
    }
    const deriveFlip = (): string => {
      const t = img.style.transform
      const h = t.includes('scaleX(-1)')
      const v = t.includes('scaleY(-1)')
      return h || v ? `${h ? 'h' : ''}${v ? 'v' : ''}` : (this.spec.flip ?? '')
    }
    const clampPct = (p: number): number => Math.min(PCT_MAX, Math.max(PCT_MIN, p))
    let pct = clampPct(derivePct())
    let flip = deriveFlip()

    const label = document.createElement('span')
    label.className = 'cm-md-image-toolbar-pct'
    const slider = document.createElement('input')
    slider.type = 'range'
    slider.min = '0'
    slider.max = '100'
    slider.step = '1'
    slider.value = String(pctToPos(pct))
    // naturalWidth is 0 while the image is still loading — disable until then
    // (the load listener below re-enables it once it's ready).
    slider.disabled = img.naturalWidth === 0
    slider.title = t('image.sizeTitle')

    const applyStyle = (p: number): void => {
      label.textContent = `${p}%`
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      if (!nw) return
      img.style.width = `${Math.round((nw * p) / 100)}px`
      img.style.height = nh ? `${Math.round((nh * p) / 100)}px` : ''
      img.style.maxWidth = 'none'
    }
    applyStyle(pct)

    slider.addEventListener('input', () => {
      pct = posToPct(Number(slider.value))
      applyStyle(pct)
    })
    slider.addEventListener('change', () => {
      const nw = img.naturalWidth
      const nh = img.naturalHeight
      if (!nw) return
      const w = Math.max(1, Math.round((nw * pct) / 100))
      const h = nh ? Math.max(1, Math.round((nh * pct) / 100)) : null
      rewriteImageNode(view, this.sourceFrom, { width: w, height: h })
    })

    const flipBtn = (bit: 'h' | 'v', glyph: string, title: string): HTMLButtonElement => {
      const btn = document.createElement('button')
      btn.className = 'cm-md-image-toolbar-btn'
      btn.textContent = glyph
      btn.title = title
      if (flip.includes(bit)) btn.classList.add('active')
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        flip = flip.includes(bit)
          ? (flip.replace(bit, '') as typeof flip)
          : ((flip + bit) as typeof flip)
        // Deterministic order for hv regardless of toggle sequence.
        if (flip === 'vh') flip = 'hv'
        img.style.transform = flipTransform(flip)
        btn.classList.toggle('active', flip.includes(bit))
        rewriteImageNode(view, this.sourceFrom, { flip: flip || null })
      })
      return btn
    }

    const reset = document.createElement('button')
    reset.className = 'cm-md-image-toolbar-btn'
    reset.textContent = '1:1'
    reset.title = t('image.resetSize')
    reset.addEventListener('click', (e) => {
      e.preventDefault()
      pct = 100
      slider.value = String(pctToPos(100))
      applyStyle(100)
      rewriteImageNode(view, this.sourceFrom, { width: null, height: null })
    })

    toolbar.append(
      label,
      slider,
      flipBtn('h', '⇋', t('image.flipH')),
      flipBtn('v', '⤒', t('image.flipV')),
      reset
    )

    // "Show in file manager" only for local files.
    const cached = imageCache.get(this.cacheKey())
    if (cached?.absPath) {
      const reveal = document.createElement('button')
      reveal.className = 'cm-md-image-toolbar-btn'
      reveal.textContent = '⏏'
      reveal.title = t('image.reveal')
      reveal.addEventListener('click', (e) => {
        e.preventDefault()
        window.api.showItemInFolder(cached.absPath!)
      })
      toolbar.appendChild(reveal)
    }

    // If the image loads while the toolbar is open, re-enable the slider.
    if (img.naturalWidth === 0) {
      img.addEventListener(
        'load',
        () => {
          if (toolbar.isConnected && slider.disabled) {
            slider.disabled = false
            // naturalWidth is only known now — re-derive before applying so a
            // committed size isn't overwritten with a stale percentage.
            pct = clampPct(derivePct())
            slider.value = String(pctToPos(pct))
            applyStyle(pct)
          }
        },
        { once: true }
      )
    }
    return toolbar
  }

  ignoreEvent(): boolean {
    return false
  }
}
