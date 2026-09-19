import { useEffect, useRef, useState } from 'react'
import { registerMermaidLightbox } from './mermaidLightboxBus'

/**
 * P16: fullscreen Mermaid viewer mounted at the App root (singleton via the
 * lightbox bus). Opens on svg-body click; wheel zoom is cursor-centered,
 * drag pans, double-click resets to 100%, Esc / mask click closes.
 */
const MIN_SCALE = 0.2
const MAX_SCALE = 10

interface ViewState {
  scale: number
  tx: number
  ty: number
}

export default function MermaidLightbox(): React.JSX.Element | null {
  const [svg, setSvg] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>({ scale: 1, tx: 0, ty: 0 })
  const stageRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(
    null
  )
  const viewRef = useRef(view)
  viewRef.current = view
  // Set on first user interaction so the centering rAF below never clobbers
  // a zoom/pan that happened while the frame was still pending.
  const interactedRef = useRef(false)

  useEffect(() => {
    registerMermaidLightbox((s) => {
      setSvg(s)
      setView({ scale: 1, tx: 0, ty: 0 })
    })
    return () => registerMermaidLightbox(null)
  }, [])

  // Center the diagram once the content has laid out.
  useEffect(() => {
    if (svg === null) return
    interactedRef.current = false
    const raf = requestAnimationFrame(() => {
      if (interactedRef.current) return
      const stage = stageRef.current
      const content = contentRef.current
      if (!stage || !content) return
      const w = content.offsetWidth
      const h = content.offsetHeight
      setView({
        scale: 1,
        tx: (stage.clientWidth - w) / 2,
        ty: (stage.clientHeight - h) / 2
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [svg])

  // Wheel must be non-passive so preventDefault can block page scroll.
  useEffect(() => {
    if (svg === null) return
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      interactedRef.current = true
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const cur = viewRef.current
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cur.scale * factor))
      const k = next / cur.scale
      // Keep the content point under the cursor fixed: t' = c - k*(c - t).
      setView({ scale: next, tx: cx - (cx - cur.tx) * k, ty: cy - (cy - cur.ty) * k })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [svg])

  // Esc closes (capture phase so editor keybindings don't see it first).
  useEffect(() => {
    if (svg === null) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setSvg(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [svg])

  if (svg === null) return null

  return (
    <div
      className="vm-mermaid-lightbox"
      data-testid="mermaid-lightbox"
      onMouseDown={(e) => {
        dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false }
      }}
      onMouseMove={(e) => {
        const d = dragRef.current
        if (!d) return
        const dx = e.clientX - d.x
        const dy = e.clientY - d.y
        if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
          d.moved = true
          interactedRef.current = true
        }
        if (d.moved) setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }))
      }}
      onMouseUp={(e) => {
        const d = dragRef.current
        dragRef.current = null
        // Mask click closes; drag and svg clicks don't.
        if (d && !d.moved && !(e.target as HTMLElement).closest('.vm-mermaid-lightbox-content')) {
          setSvg(null)
        }
      }}
      onDoubleClick={() => setView({ scale: 1, tx: 0, ty: 0 })}
    >
      <div className="vm-mermaid-lightbox-stage" ref={stageRef}>
        <div
          className="vm-mermaid-lightbox-content"
          ref={contentRef}
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  )
}
