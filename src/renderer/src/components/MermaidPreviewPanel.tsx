import { useEffect, useRef, useState } from 'react'
import { renderMermaid, exportSvg, exportPng, copyPngImage } from '../editor/mermaid'
import type { ThemeName } from '../editor/theme'
import { t } from '../i18n'

export interface MermaidPreviewPanelProps {
  /** Fence body (projection input — always re-read from the CM6 doc upstream). */
  code: string
  theme: ThemeName
  pin: boolean
  /** wave⑥-7 F2: true while the leave-fence shrink transition is playing. */
  collapsing?: boolean
  height: number
  onTogglePin: () => void
  onHeightChange: (h: number) => void
  onClose: () => void
}

/**
 * P25 route-B mermaid live preview: pure projection over the CM6 document.
 * Debounced 300ms render through renderMermaid (P15 queue); render failures
 * keep the last good SVG (dimmed) and show the P16-style error bar. The
 * panel holds no writable editor state — no contenteditable, no write-back.
 */
export function MermaidPreviewPanel({
  code,
  theme,
  pin,
  collapsing = false,
  height,
  onTogglePin,
  onHeightChange,
  onClose
}: MermaidPreviewPanelProps): React.JSX.Element {
  const svgRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const svg = await renderMermaid(code, theme)
          if (cancelled) return
          if (svgRef.current) {
            svgRef.current.innerHTML = svg
            svgRef.current.classList.remove('is-dim')
          }
          setError(null)
        } catch (e) {
          if (cancelled) return
          // Keep the previous SVG visible (dimmed) — P16 error UX.
          svgRef.current?.classList.add('is-dim')
          setError(e instanceof Error ? e.message : String(e))
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [code, theme])

  // Drag the split handle to resize; height is persisted by the App via prefs.
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const onResizeDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startH: height }
    const onMove = (ev: MouseEvent): void => {
      const d = dragRef.current
      if (!d) return
      onHeightChange(Math.min(800, Math.max(120, d.startH + (d.startY - ev.clientY))))
    }
    const onUp = (): void => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const copySource = (): void => {
    void (async () => {
      try {
        await window.api.clipboardWrite(code)
      } catch {
        return
      }
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 1000)
    })()
  }

  const svgEl = (): SVGSVGElement | null => svgRef.current?.querySelector('svg') ?? null

  return (
    <div
      className={`mermaid-preview-panel${collapsing ? ' is-collapsing' : ''}`}
      style={{ height }}
      data-testid="mermaid-preview-panel"
      data-collapsing={collapsing ? 'true' : 'false'}
    >
      <div className="mermaid-preview-resize" onMouseDown={onResizeDown} />
      <div className="mermaid-preview-bar">
        <span className="mermaid-preview-title">{t('mermaidPreview.title')}</span>
        <button
          type="button"
          className={`mermaid-preview-pin${pin ? ' is-on' : ''}`}
          onClick={onTogglePin}
          aria-pressed={pin}
        >
          {pin ? t('mermaidPreview.unpin') : t('mermaidPreview.pin')}
        </button>
        <button type="button" className="mermaid-preview-copy-src" onClick={copySource}>
          {copied ? '✓' : t('mermaidPreview.copySource')}
        </button>
        <button
          type="button"
          className="mermaid-preview-svg-btn"
          onClick={() => {
            const el = svgEl()
            if (el) void exportSvg(el)
          }}
        >
          SVG
        </button>
        <button
          type="button"
          className="mermaid-preview-png-btn"
          onClick={() => {
            const el = svgEl()
            if (el) void exportPng(el)
          }}
        >
          PNG
        </button>
        <button
          type="button"
          className="mermaid-preview-copy-img"
          onClick={() => {
            const el = svgEl()
            if (el) void copyPngImage(el)
          }}
        >
          {t('mermaid.copyImage')}
        </button>
        <button type="button" className="mermaid-preview-close" onClick={onClose}>
          {t('mermaidPreview.close')}
        </button>
      </div>
      <div className="mermaid-preview-body">
        {error != null && (
          <div className="mermaid-preview-error">
            {t('mermaid.errorLabel')}: {error}
          </div>
        )}
        <div className="mermaid-preview-svg" ref={svgRef} data-testid="mermaid-preview-svg" />
      </div>
    </div>
  )
}
