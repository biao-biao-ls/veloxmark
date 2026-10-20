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


interface CachedImage {
  src: string
  mtime: number | null
  absPath: string | null
}

const imageCache = new Map<string, CachedImage>()

export function closeAllImageSelections(): void {
  for (const el of document.querySelectorAll('.cm-md-image-wrap.cm-md-image-selected')) {
    el.classList.remove('cm-md-image-selected')
    el.querySelector('.cm-md-image-toolbar')?.remove()
  }
}

export function invalidateImageCache(): void {
  imageCache.clear()
}

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
    readonly sourceFrom: number,
    readonly sourceTo: number,
    readonly epoch: number = 0,
    readonly i18nEpoch: number = 0
  ) {
    super()
  }

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
      img.style.maxWidth = 'none'
    }
    if (this.spec.flip) img.style.transform = flipTransform(this.spec.flip)
    applyImageAlignDom(wrap, this.spec.align)
    wrap.appendChild(img)

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

  private buildErrorBar(wrap: HTMLElement, img: HTMLImageElement, ph: HTMLElement): HTMLElement {
    const bar = document.createElement('div')
    bar.className = 'cm-md-image-error-bar'
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
      void assertWritable().then((ok) => {
        if (!ok) return
        const input = document.createElement('input')
        input.className = 'cm-md-float-input'
        input.setAttribute('data-testid', 'image-src-input')
        input.placeholder = t('render.image.urlPlaceholder')
        input.setAttribute('aria-label', t('render.image.editUrlTitle'))
        input.value = imageSrcAtAnchor(wrap) ?? this.spec.src

        const confirmEdit = (): void => {
          const next = input.value.trim()
          if (!isValidImageSrc(next)) return
          const current = imageSrcAtAnchor(wrap) ?? this.spec.src
          if (next === current) {
            showActions()
            return
          }
          void applyImageEditAtAnchor(wrap, { src: next }, 'src').then((ok) => {
            if (!ok) return
          })
        }

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            confirmEdit()
          } else if (e.key === 'Escape') {
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

  private mountSelection(wrap: HTMLElement, img: HTMLImageElement, view: EditorView): void {
    img.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    img.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const verdict = judgeClickSemantics({ hitTarget: 'image', selectionEmpty: true })
      if (verdict.kind !== 'edit') return
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
    toolbar.addEventListener('mousedown', (e) => {
      e.stopPropagation()
      const t = e.target
      if (!(t instanceof Element && t.closest('input, button, select, textarea'))) {
        e.preventDefault()
      }
    })
    toolbar.addEventListener('click', (e) => e.stopPropagation())

    const PCT_MIN = 25
    const PCT_MAX = 400
    const RATIO = PCT_MAX / PCT_MIN
    const posToPct = (pos: number): number =>
      Math.min(PCT_MAX, Math.max(PCT_MIN, Math.round(PCT_MIN * Math.pow(RATIO, pos / 100))))
    const pctToPos = (pct: number): number =>
      Math.min(
        100,
        Math.max(0, Math.round((100 * Math.log(pct / PCT_MIN)) / Math.log(RATIO)))
      )

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

    if (img.naturalWidth === 0) {
      img.addEventListener(
        'load',
        () => {
          if (toolbar.isConnected && slider.disabled) {
            slider.disabled = false
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
