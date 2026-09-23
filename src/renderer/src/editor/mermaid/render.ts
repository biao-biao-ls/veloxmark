import mermaid from 'mermaid'
import type { ThemeName } from '../theme'

// ---- mermaid ---------------------------------------------------------------
// (2.3: rendering core moved verbatim from editor/widgets.ts — cache +
// concurrency gate + base init. Module state mermaidCache lives HERE and only
// here; consumers go through renderMermaid/clearMermaidCache.)

const mermaidCache = new Map<string, string>()
let mermaidSeq = 0
let mermaidBaseInitialized = false

// P15: mermaid.render is main-thread heavy — a large document full of
// diagrams would otherwise kick off dozens of concurrent renders on one
// rebuild. Cap concurrency at 2; excess callers queue FIFO.
const MERMAID_MAX_CONCURRENCY = 2
let mermaidActive = 0
const mermaidWaiters: Array<() => void> = []

async function acquireMermaidSlot(): Promise<void> {
  if (mermaidActive < MERMAID_MAX_CONCURRENCY) {
    mermaidActive++
    return
  }
  await new Promise<void>((resolve) => {
    mermaidWaiters.push(resolve)
  })
  // Slot was transferred to us by releaseMermaidSlot — already counted.
}

function releaseMermaidSlot(): void {
  const next = mermaidWaiters.shift()
  if (next) next()
  else mermaidActive--
}

function ensureMermaidBase(): void {
  if (mermaidBaseInitialized) return
  mermaidBaseInitialized = true
  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: 'neutral',
    fontFamily:
      "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif"
  })
}

export function clearMermaidCache(): void {
  mermaidCache.clear()
}

export async function renderMermaid(code: string, theme: ThemeName): Promise<string> {
  const key = `${theme}\n${code}`
  // Cache hits skip the queue entirely.
  const cached = mermaidCache.get(key)
  if (cached) return cached
  await acquireMermaidSlot()
  try {
    ensureMermaidBase()
    // Re-check: a queued predecessor may have rendered the same diagram.
    const again = mermaidCache.get(key)
    if (again) return again
    mermaid.initialize({
      startOnLoad: false,
      suppressErrorRendering: true,
      theme: theme === 'dark' ? 'dark' : 'neutral',
      fontFamily:
        "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif"
    })
    const { svg } = await mermaid.render(`mmd-${mermaidSeq++}`, code)
    mermaidCache.set(key, svg)
    return svg
  } finally {
    releaseMermaidSlot()
  }
}
