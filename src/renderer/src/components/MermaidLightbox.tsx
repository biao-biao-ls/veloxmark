import { useEffect, useRef, useState } from 'react'
import { registerMermaidLightbox } from './mermaidLightboxBus'

const MIN_SCALE = 0.2
const MAX_SCALE = 10
const PAD = 32

interface SvgPayload {
  svg: string
  w: number
  h: number
}

interface ViewState {
  scale: number
  tx: number
  ty: number
}

function parseSvgSize(svg: string): { w: number; h: number } {
  const vb = /viewBox="([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)"/.exec(svg)
  if (vb) {
    const w = Number(vb[3])
    const h = Number(vb[4])
    if (w > 0 && h > 0) return { w, h }
  }
  const aw = /<svg\b[^>]*\swidth="([\d.]+)(?:px)?"/i.exec(svg)
  const ah = /<svg\b[^>]*\sheight="([\d.]+)(?:px)?"/i.exec(svg)
  return { w: aw ? Number(aw[1]) : 960, h: ah ? Number(ah[1]) : 720 }
}

function fitView(stageW: number, stageH: number, w: number, h: number): ViewState {
  const raw = Math.min((stageW - PAD * 2) / w, (stageH - PAD * 2) / h)
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw))
  return {
    scale,
    tx: (stageW - (w * scale + PAD)) / 2,
    ty: (stageH - (h * scale + PAD)) / 2
  }
}

export default function MermaidLightbox(): React.JSX.Element | null {
  const [payload, setPayload] = useState<SvgPayload | null>(null)
  const [view, setView] = useState<ViewState>({ scale: 1, tx: 0, ty: 0 })
  const stageRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(
    null
  )
  const viewRef = useRef(view)
  viewRef.current = view
  const interactedRef = useRef(false)

  useEffect(() => {
    registerMermaidLightbox((s) => {
      const size = parseSvgSize(s)
      setPayload({ svg: s, w: size.w, h: size.h })
      setView({ scale: 1, tx: 0, ty: 0 })
    })
    return () => registerMermaidLightbox(null)
  }, [])

  useEffect(() => {
    if (payload === null) return
    interactedRef.current = false
    const raf = requestAnimationFrame(() => {
      if (interactedRef.current) return
      const stage = stageRef.current
      if (!stage) return
      setView(fitView(stage.clientWidth, stage.clientHeight, payload.w, payload.h))
    })
    return () => cancelAnimationFrame(raf)
  }, [payload])

  useEffect(() => {
    if (payload === null) return
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
      setView({ scale: next, tx: cx - (cx - cur.tx) * k, ty: cy - (cy - cur.ty) * k })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [payload])

  useEffect(() => {
    if (payload === null) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setPayload(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [payload])

  if (payload === null) return null

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
        if (d && !d.moved && !(e.target as HTMLElement).closest('.vm-mermaid-lightbox-content')) {
          setPayload(null)
        }
      }}
      onDoubleClick={() => {
        interactedRef.current = true
        const stage = stageRef.current
        if (stage) setView(fitView(stage.clientWidth, stage.clientHeight, payload.w, payload.h))
      }}
    >
      <div className="vm-mermaid-lightbox-stage" ref={stageRef}>
        <div
          className="vm-mermaid-lightbox-content"
          style={{
            width: payload.w * view.scale,
            transform: `translate(${view.tx}px, ${view.ty}px)`
          }}
          dangerouslySetInnerHTML={{ __html: payload.svg }}
        />
      </div>
      <div className="vm-mermaid-lightbox-zoom" aria-live="polite">
        {Math.round(view.scale * 100)}%
      </div>
    </div>
  )
}
