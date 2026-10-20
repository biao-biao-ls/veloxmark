import { useEffect } from 'react'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { buildDecorations } from '../../editor/livePreview/build'
import { DEFAULT_LIVE_PREVIEW_CONFIG } from '../../editor/livePreview/config'

export function useP15Seam(): void {
  useEffect(() => {
    window.__veloxP15 = {
      bench: (lines, formulas, samples = 100) => {
        const parts: string[] = []
        for (let i = 1; i <= lines; i++) {
          if (i % 7 === 0) parts.push(`## Section ${i}`)
          else if (i % 3 === 0) parts.push(`line ${i} with **bold** and \`code\` and [link](./x${i}.md)`)
          else parts.push(`line ${i} plain text for padding the document body`)
        }
        for (let f = 0; f < formulas; f++) {
          const at = Math.min(parts.length - 1, Math.floor(((f + 1) * parts.length) / (formulas + 1)))
          parts.splice(at, 0, `$$E_${f} = mc^2 + \\frac{${f}}{2} + \\sum_{i=1}^{${f}} i$$`)
        }
        const base = parts.join('\n')
        let state = EditorState.create({
          doc: `${base}\n\ntype-here: `,
          extensions: [markdown()]
        })
        ensureSyntaxTree(state, state.doc.length, 300000)
        const cfg = DEFAULT_LIVE_PREVIEW_CONFIG
        const times: number[] = []
        for (let i = 0; i < samples; i++) {
          const insertAt = state.doc.length - 1
          state = state.update({ changes: { from: insertAt, insert: 'x' } }).state
          ensureSyntaxTree(state, state.doc.length, 300000)
          const t0 = performance.now()
          buildDecorations(state, cfg)
          times.push(performance.now() - t0)
        }
        const sorted = [...times].sort((a, b) => a - b)
        const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length)
        const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0
        return { lines, formulas, samples: times.length, avg, p95, max: sorted[sorted.length - 1] ?? 0 }
      }
    }
  }, [])
}
