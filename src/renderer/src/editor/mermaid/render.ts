import mermaid from 'mermaid'
import type { ThemeName } from '../theme'


const mermaidCache = new Map<string, string>()
let mermaidSeq = 0
let mermaidBaseInitialized = false

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

function normalizeMermaidSvg(svg: string): string {
  return svg.replace(/(<svg\b[^>]*?)\sstyle="([^"]*)"/i, (_all, head: string, style: string) => {
    const kept = style
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s !== '' && !/^max-width\s*:/i.test(s))
      .join('; ')
    return kept ? `${head} style="${kept}"` : head
  })
}

export async function renderMermaid(code: string, theme: ThemeName): Promise<string> {
  const key = `${theme}\n${code}`
  const cached = mermaidCache.get(key)
  if (cached) return cached
  await acquireMermaidSlot()
  try {
    ensureMermaidBase()
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
    const normalized = normalizeMermaidSvg(svg)
    mermaidCache.set(key, normalized)
    return normalized
  } finally {
    releaseMermaidSlot()
  }
}
