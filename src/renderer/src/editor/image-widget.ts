import { EditorView, WidgetType } from '@codemirror/view'
import { hoverDiscipline, HOVER_CHANNELS } from '../hooks/useHoverDiscipline'
import { t } from '../i18n'
import { judgeClickSemantics } from './clickSemantics'
import { attachWidgetContextMenu } from './contextMenu/widgetEntry'
import {
  applyImageEdit,
  applyImageEditAtAnchor,
  imageSrcAtAnchor,
  isValidImageSrc
} from './imageEdit'
import {
  deriveWidthPct,
  flipTransform,
  type ImageAlign,
  type ImageFlip,
  type ParsedImage
} from './image-parse'
import { assertWritable } from './readOnlyGuard'

// ---- images (P05 + IT-03 FE-04) ----------------------------------------------
// (2.4: resolution cache and ImageWidget moved verbatim from editor/widgets.ts.)
// ParsedImage / parseImageMarkdown / flipTransform live in image-parse.ts.
// Write-backs (size/align/flip) all go through imageEdit.applyImageEdit — the
// single read-only gate + single-dispatch path (AC-ERR-08 / AC-OP-13 undo).

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
 * Reflect `{align=…}` on the image wrapper so CSS can place it. Called from
 * toDOM (spec) and live from the edit float (after a commit) — the DOM is the
 * single visual source once rendered (same stale-widget discipline as
 * `derivePct` in the zoom toolbar).
 */
export function applyImageAlignDom(wrap: HTMLElement, align: ImageAlign | undefined): void {
  wrap.classList.remove(
    'cm-md-image-align-left',
    'cm-md-image-align-center',
    'cm-md-image-align-right'
  )
  if (align) wrap.classList.add(`cm-md-image-align-${align}`)
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
    applyImageAlignDom(wrap, this.spec.align)
    wrap.appendChild(img)

    // Broken/missing image: placeholder with the alt text + repair bar with
    // 「重试」/「编辑地址」(ui_06 错误可修复 rule card) — never a silent hole.
    // The img element stays in the DOM (hidden via .cm-md-image-broken) so a
    // retry can re-fire its load listeners without rebuilding the widget.
    img.addEventListener('error', () => {
      if (!img.getAttribute('src') || wrap.classList.contains('cm-md-image-broken')) return
      wrap.classList.add('cm-md-image-broken')
      const ph = document.createElement('span')
      ph.className = 'cm-md-image-placeholder'
      ph.textContent = this.spec.alt || t('image.notFound')
      wrap.append(ph, this.buildErrorBar(wrap, img, ph))
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

  /**
   * Broken-state repair bar (FE-04 失败态可修复入口): 「重试」re-resolves and
   * re-loads; 「编辑地址」enters a src edit session that writes the markdown
   * destination back through applyImageEditAtAnchor (read-only gate + single
   * dispatch). Keyboard reachability is the natural tab order of real buttons.
   */
  private buildErrorBar(wrap: HTMLElement, img: HTMLImageElement, ph: HTMLElement): HTMLElement {
    const bar = document.createElement('div')
    bar.className = 'cm-md-image-error-bar'
    // Keep events from reaching CM (cursor move / source reveal) but never
    // preventDefault on form controls — same discipline as the zoom toolbar.
    bar.addEventListener('mousedown', (e) => {
      e.stopPropagation()
      const target = e.target
      if (!(target instanceof Element && target.closest('input, button'))) e.preventDefault()
    })
    bar.addEventListener('click', (e) => e.stopPropagation())

    const clearBroken = (): void => {
      wrap.classList.remove('cm-md-image-broken')
      ph.remove()
      bar.remove()
    }

    const retry = (): void => {
      // Drop this src's resolution (next resolve re-stats → fresh `v=` cache
      // bust) and reset the attribute so Chromium re-requests even when the
      // resolved URL is byte-identical. Side-effect-free → no read-only gate.
      clearBroken()
      imageCache.delete(this.cacheKey())
      img.removeAttribute('src')
      this.mountResolvedSrc(img)
    }

    const makeBtn = (
      testId: string,
      label: string,
      title: string,
      onClick: () => void
    ): HTMLButtonElement => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'cm-md-image-toolbar-btn'
      btn.setAttribute('data-testid', testId)
      btn.textContent = label
      btn.title = title
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        onClick()
      })
      return btn
    }

    const showActions = (): void => {
      const msg = document.createElement('span')
      msg.className = 'cm-md-image-error-msg'
      msg.textContent = t('render.image.broken')
      bar.replaceChildren(
        msg,
        makeBtn('image-retry-btn', t('render.image.retry'), t('render.image.retryTitle'), retry),
        makeBtn(
          'image-edit-src-btn',
          t('render.image.editUrl'),
          t('render.image.editUrlTitle'),
          enterEdit
        )
      )
    }

    const enterEdit = (): void => {
      // AC-ERR-08 pre-check — assertWritable fires the frozen err.readonly
      // toast on refusal. Retry stays ungated (side-effect-free).
      void assertWritable().then((ok) => {
        if (!ok) return
        const input = document.createElement('input')
        input.className = 'cm-md-float-input'
        input.setAttribute('data-testid', 'image-src-input')
        input.placeholder = t('render.image.urlPlaceholder')
        input.setAttribute('aria-label', t('render.image.editUrlTitle'))
        // Live src from the syntax tree (stale-widget discipline); spec is fallback.
        input.value = imageSrcAtAnchor(wrap) ?? this.spec.src

        const confirmEdit = (): void => {
          const next = input.value.trim()
          // Silent refusal — stay in edit mode (linkEdit.isValidLinkHref face).
          if (!isValidImageSrc(next)) return
          const current = imageSrcAtAnchor(wrap) ?? this.spec.src
          if (next === current) {
            showActions()
            return
          }
          void applyImageEditAtAnchor(wrap, { src: next }, 'src').then((ok) => {
            // Refused (read-only gate / unresolvable node) — stay in edit mode.
            // Success: eq() sees a new src and rebuilds this DOM with a fresh
            // resolve, so nothing to tear down here.
            if (!ok) return
          })
        }

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            confirmEdit()
          } else if (e.key === 'Escape') {
            // Local cancel only — don't let Esc reach the hush layer mid-edit.
            e.preventDefault()
            e.stopPropagation()
            showActions()
          }
        })

        bar.replaceChildren(
          input,
          makeBtn('image-src-confirm-btn', t('render.link.confirm'), t('render.link.confirm'), confirmEdit),
          makeBtn('image-src-cancel-btn', t('render.link.cancel'), t('render.link.cancel'), showActions)
        )
        input.focus()
        input.select()
      })
    }

    showActions()
    return bar
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
      // FE-09 AC-RULE-13 unified decision (ren-click:semantics). Widget
      // content cannot host a text selection (mousedown preventDefault above),
      // so a press-release on the image is a click gesture — writer path
      // first even if a stale selection exists. `kind === 'select'` is kept as
      // the safe no-op face of the route table for selection-capable callers.
      const verdict = judgeClickSemantics({ hitTarget: 'image', selectionEmpty: true })
      if (verdict.kind !== 'edit') return
      // AC-FN-17「图=编辑浮层」: click deterministically enters the FE-04
      // edit form (hover dwell alone is not a click route). Broken images
      // have no parse result → float stays disabled (REN disable rule).
      if (!wrap.classList.contains('cm-md-image-broken')) {
        hoverDiscipline.show(HOVER_CHANNELS.imageFloat, wrap)
      }
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

    // The toolbar may be built from a STALE widget instance: eq() reuses this
    // DOM (and its listeners) across size/flip commits, so `this.spec` can
    // predate the latest source rewrite. The rendered element always carries
    // the committed state (applyStyle / flip toggles write it live), so derive
    // from it — reading spec here would reset a resized image to 100% on
    // re-select. Formula + fallback 口径 (style.width → spec.width → 100) are
    // the shared image-parse.deriveWidthPct.
    const derivePct = (): number =>
      deriveWidthPct(img.style.width, img.naturalWidth, this.spec.width)
    const deriveFlip = (): ImageFlip | '' => {
      const t = img.style.transform
      const h = t.includes('scaleX(-1)')
      const v = t.includes('scaleY(-1)')
      return h || v ? (`${h ? 'h' : ''}${v ? 'v' : ''}` as ImageFlip) : (this.spec.flip ?? '')
    }
    const clampPct = (p: number): number => Math.min(PCT_MAX, Math.max(PCT_MIN, p))
    let pct = clampPct(derivePct())
    let flip: ImageFlip | '' = deriveFlip()

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
      void applyImageEdit(view, this.sourceFrom, { width: w, height: h }, 'size')
    })

    const flipBtn = (bit: 'h' | 'v', glyph: string, title: string): HTMLButtonElement => {
      const btn = document.createElement('button')
      btn.className = 'cm-md-image-toolbar-btn'
      btn.textContent = glyph
      btn.title = title
      if (flip.includes(bit)) btn.classList.add('active')
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        // Bit toggle with a deterministic 'hv' order regardless of click sequence.
        const h = bit === 'h' ? !flip.includes('h') : flip.includes('h')
        const v = bit === 'v' ? !flip.includes('v') : flip.includes('v')
        flip = h && v ? 'hv' : h ? 'h' : v ? 'v' : ''
        img.style.transform = flipTransform(flip)
        btn.classList.toggle('active', flip.includes(bit))
        void applyImageEdit(view, this.sourceFrom, { flip: flip === '' ? null : flip }, 'flip')
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
      void applyImageEdit(view, this.sourceFrom, { width: null, height: null }, 'size')
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
