/**
 * wave⑤ block-delta context-menu registrations (P05/P06/P11/P16/P18/P21/P24).
 *
 * Each factory receives the shared (view, hit, rt) triple at menu-open time
 * and returns block-specific items; the registry assembles them above the
 * generic cut/copy/paste skeleton. Ops re-read doc/DOM at click time (stale-
 * instance discipline). ids are the e2e contract — probes key on data-op.
 */
import { syntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'
import { t } from '../../i18n'
import { copyPngImage, exportPng, exportSvg } from '../widgets'
import {
  expandFolds,
  foldKey,
  getFoldedKeys,
  headingAtPos,
  toggleFold
} from '../livePreview/fold'
import { extractOutline } from '../../outline/extract'
import { parseCalloutMarker } from '../livePreview/callout'
import { registerContextMenuOps } from './registry'
import type { BlockHit, CtxMenuItem, CtxRuntime } from './types'

/** First enclosing syntax node matching `names` around `pos`. */
function enclosingNode(
  view: EditorView,
  pos: number,
  names: string[]
): { from: number; to: number; name: string } | null {
  const tree = syntaxTree(view.state)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = tree.resolveInner(pos, 1)
  for (; cur; cur = cur.parent) {
    if (names.includes(cur.name)) return { from: cur.from, to: cur.to, name: cur.name }
  }
  return null
}

/** $$…$$ body range when the hit sits inside display math (DOM-detected). */
function mathRange(view: EditorView, pos: number): { from: number; to: number } | null {
  const state = view.state
  let line = state.doc.lineAt(pos)
  const isOpen = (text: string): boolean => /^\s*\$\$/.test(text)
  const isClose = (text: string): boolean => /\$\$\s*$/.test(text) && !isOpen(text)
  let fromLine = line
  while (fromLine.number > 1 && !isOpen(fromLine.text)) fromLine = state.doc.lineAt(fromLine.from - 1)
  if (!isOpen(fromLine.text) && !/\$\$/.test(fromLine.text)) return null
  let toLine = line
  const last = state.doc.lines
  while (toLine.number < last && !(toLine.number > fromLine.number && isClose(toLine.text))) {
    toLine = state.doc.lineAt(toLine.to + 1)
  }
  return { from: fromLine.from, to: toLine.to }
}

/** Body text of a fenced code block (skips the ```lang opener + closer). */
function fenceBody(view: EditorView, range: { from: number; to: number }): string {
  const state = view.state
  const first = state.doc.lineAt(range.from)
  const last = state.doc.lineAt(range.to)
  const bodyFrom = first.to < last.from ? first.to + 1 : first.to
  const bodyTo = last.from > first.to ? last.from - 1 : last.to
  return state.sliceDoc(Math.min(bodyFrom, range.to), Math.max(bodyFrom, bodyTo))
}

/** Rendered <svg> for the mermaid block whose fence contains `pos`. */
function mermaidSvgAt(view: EditorView, pos: number): SVGSVGElement | null {
  try {
    const domInfo = view.domAtPos(pos)
    let el: HTMLElement | null =
      (domInfo.node instanceof HTMLElement ? domInfo.node : domInfo.node.parentElement)
    el = el?.closest('.cm-md-mermaid') ?? null
    return el?.querySelector('svg') ?? null
  } catch {
    return null
  }
}

function deleteRange(view: EditorView, range: { from: number; to: number }, userEvent: string): void {
  const state = view.state
  const last = state.doc.lines
  const endLine = state.doc.lineAt(range.to)
  const to = endLine.number < last ? endLine.to + 1 : range.to
  view.dispatch({
    changes: { from: range.from, to: Math.min(to, state.doc.length), insert: '' },
    selection: { anchor: range.from },
    userEvent
  })
}

async function confirmDanger(rt: CtxRuntime, message: string): Promise<boolean> {
  return rt.confirm({ title: t('ctx.deleteBlock'), message, danger: true })
}

// ---- P05 image deltas --------------------------------------------------------

registerContextMenuOps('image', (view, hit, rt) => {
  const href = hit.href ?? ''
  const node = enclosingNode(view, hit.pos, ['Image'])
  const src = node ? view.state.sliceDoc(node.from, node.to) : href
  const items: CtxMenuItem[] = [
    {
      id: 'image.copyPath',
      label: t('ctx.copyPath'),
      run: () => {
        void rt.clipboardWrite(href)
        rt.toast(t('toast.copied'))
      }
    },
    {
      id: 'image.copyMarkdown',
      label: t('ctx.copyImageMarkdown'),
      run: () => {
        void rt.clipboardWrite(src)
        rt.toast(t('toast.copied'))
      }
    }
  ]
  if (href) {
    items.push({
      id: 'image.reveal',
      label: t('ctx.revealInFolder'),
      run: () => {
        const baseDir = rt.getBaseDir?.() ?? ''
        void window.api.resolveImageSrc(baseDir, href).then((resolved) => {
          if (resolved?.absPath) window.api.showItemInFolder(resolved.absPath)
          else rt.toast(t('image.notFound'))
        })
      }
    })
    // P05-F6: delete image file — confirm → IPC deletePath → drop the node.
    items.push({
      id: 'image.deleteFile',
      label: t('ctx.deleteImageFile'),
      danger: true,
      run: () => {
        void confirmDanger(rt, t('ctx.deleteImageConfirm')).then(async (ok) => {
          if (!ok) return
          const baseDir = rt.getBaseDir?.() ?? ''
          const resolved = await window.api.resolveImageSrc(baseDir, href)
          if (resolved?.absPath) await window.api.deletePath(resolved.absPath)
          if (node) {
            view.dispatch({
              changes: { from: node.from, to: node.to, insert: '' },
              userEvent: 'delete.image'
            })
          }
          rt.toast(t('ctx.deletedImage'))
        })
      }
    })
  }
  return items
})

// ---- P16 mermaid deltas ------------------------------------------------------

registerContextMenuOps('mermaid', (view, hit, rt) => {
  const fence = enclosingNode(view, hit.pos, ['FencedCode', 'CodeBlock'])
  const range = fence ?? { from: hit.lineFrom, to: hit.lineTo }
  return [
    {
      id: 'mermaid.editSource',
      label: t('ctx.mermaidEditSource'),
      run: () => {
        const state = view.state
        const first = state.doc.lineAt(range.from)
        const bodyStart = first.to + 1
        view.dispatch({ selection: { anchor: Math.min(bodyStart, state.doc.length) } })
        view.focus()
      }
    },
    {
      id: 'mermaid.copySource',
      label: t('ctx.mermaidCopySource'),
      run: () => {
        void rt.clipboardWrite(fenceBody(view, range))
        rt.toast(t('toast.copied'))
      }
    },
    {
      id: 'mermaid.copyAsImage',
      label: t('ctx.copyAsImage'),
      run: () => {
        const svg = mermaidSvgAt(view, hit.pos)
        if (!svg) {
          rt.toast(t('toast.exportFailed'))
          return
        }
        void copyPngImage(svg)
      }
    },
    {
      id: 'mermaid.saveSvg',
      label: t('ctx.saveAsSvg'),
      run: () => {
        const svg = mermaidSvgAt(view, hit.pos)
        if (!svg) {
          rt.toast(t('toast.exportFailed'))
          return
        }
        void exportSvg(svg)
      }
    },
    {
      id: 'mermaid.savePng',
      label: t('ctx.saveAsPng'),
      run: () => {
        const svg = mermaidSvgAt(view, hit.pos)
        if (!svg) {
          rt.toast(t('toast.exportFailed'))
          return
        }
        void exportPng(svg)
      }
    },
    {
      id: 'mermaid.deleteBlock',
      label: t('ctx.deleteBlock'),
      danger: true,
      run: () => {
        void confirmDanger(rt, t('ctx.deleteBlockConfirm')).then((ok) => {
          if (ok) deleteRange(view, range, 'delete.mermaid')
        })
      }
    }
  ]
})

// ---- P24 code-block deltas ---------------------------------------------------

registerContextMenuOps('code-block', (view, hit, rt) => {
  const fence = enclosingNode(view, hit.pos, ['FencedCode', 'CodeBlock'])
  const range = fence ?? { from: hit.lineFrom, to: hit.lineTo }
  return [
    {
      id: 'code.copyCode',
      label: t('ctx.copyCode'),
      run: () => {
        void rt.clipboardWrite(fenceBody(view, range))
        rt.toast(t('toast.copied'))
      }
    },
    {
      id: 'code.indentBlock',
      label: t('ctx.indentBlock'),
      run: () => indentFenceBody(view, range)
    },
    {
      id: 'code.indentSelection',
      label: t('ctx.indentSelection'),
      run: () => indentSelectedLines(view, range)
    },
    {
      id: 'code.deleteBlock',
      label: t('ctx.deleteBlock'),
      danger: true,
      run: () => {
        void confirmDanger(rt, t('ctx.deleteBlockConfirm')).then((ok) => {
          if (ok) deleteRange(view, range, 'delete.code')
        })
      }
    }
  ]
})

/** UX-P24 F1: indent every body line of the enclosing fence by two spaces. */
function indentFenceBody(view: EditorView, range: { from: number; to: number }): void {
  const state = view.state
  const bodyFrom = range.from
  const bodyTo = range.to
  const first = state.doc.lineAt(bodyFrom)
  const last = state.doc.lineAt(bodyTo)
  const changes: { from: number; to: number; insert: string }[] = []
  for (let n = first.number; n <= last.number; n++) {
    const line = state.doc.line(n)
    if (/^\s*```/.test(line.text)) continue
    if (!line.text.length) continue
    changes.push({ from: line.from, to: line.from, insert: '  ' })
  }
  if (!changes.length) return
  view.dispatch({ changes, userEvent: 'indent.code' })
}

/** UX-P24 F1: indent the lines the user selected (falls back to fence body). */
function indentSelectedLines(view: EditorView, range: { from: number; to: number }): void {
  const state = view.state
  const sel = state.selection.main
  const from = sel.empty ? range.from : sel.from
  const to = sel.empty ? range.to : sel.to
  const first = state.doc.lineAt(from)
  const last = state.doc.lineAt(to)
  const changes: { from: number; to: number; insert: string }[] = []
  for (let n = first.number; n <= last.number; n++) {
    const line = state.doc.line(n)
    if (/^\s*```/.test(line.text)) continue
    if (!line.text.length) continue
    changes.push({ from: line.from, to: line.from, insert: '  ' })
  }
  if (!changes.length) return
  view.dispatch({ changes, userEvent: 'indent.selection' })
}

// ---- P06 math-block deltas ---------------------------------------------------

registerContextMenuOps('math-block', (view, hit, rt) => {
  return [
    {
      id: 'math.copyTex',
      label: t('ctx.copyTex'),
      run: () => {
        const range = mathRange(view, hit.pos)
        const raw = range ? view.state.sliceDoc(range.from, range.to) : ''
        const tex = raw.replace(/^\s*\$\$/, '').replace(/\$\$\s*$/, '').trim()
        void rt.clipboardWrite(tex)
        rt.toast(t('toast.copied'))
      }
    },
    {
      id: 'math.deleteBlock',
      label: t('ctx.deleteBlock'),
      danger: true,
      run: () => {
        void confirmDanger(rt, t('ctx.deleteBlockConfirm')).then((ok) => {
          const range = mathRange(view, hit.pos)
          if (ok && range) deleteRange(view, range, 'delete.math')
        })
      }
    }
  ]
})

// ---- P21 callout type-switch -------------------------------------------------

const CALLOUT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const

registerContextMenuOps('callout', (view, hit, rt) => {
  const bq = enclosingNode(view, hit.pos, ['Blockquote'])
  if (!bq) return []
  const first = view.state.doc.lineAt(bq.from)
  const marker = parseCalloutMarker(first.text)
  if (!marker) return []
  return [
    {
      id: 'callout.type',
      label: t('ctx.calloutType'),
      submenu: CALLOUT_TYPES.map((type) => ({
        id: `callout.type.${type}`,
        label: t(`callout.${type}`),
        checked: marker.rawType.toLowerCase() === type,
        run: () => {
          const next = first.text.replace(/^(\s*>\s*)\[![^\]]*\]/, `$1[!${type}]`)
          if (next !== first.text) {
            view.dispatch({
              changes: { from: first.from, to: first.to, insert: next },
              userEvent: 'callout.type'
            })
          }
        }
      }))
    },
    {
      id: 'callout.deleteBlock',
      label: t('ctx.deleteBlock'),
      danger: true,
      run: () => {
        void confirmDanger(rt, t('ctx.deleteBlockConfirm')).then((ok) => {
          if (ok) deleteRange(view, bq, 'delete.callout')
        })
      }
    }
  ]
})

// ---- P18 heading fold deltas -------------------------------------------------

registerContextMenuOps('heading', (view, hit, rt) => {
  return [
    {
      id: 'heading.foldSection',
      label: t('ctx.foldSection'),
      run: () => {
        const heading = headingAtPos(view.state, hit.pos)
        if (!heading) return
        view.dispatch({ effects: toggleFold.of(foldKey(heading.level, heading.text)) })
      }
    },
    {
      id: 'heading.foldAll',
      label: t('cmd.foldAll'),
      run: () => {
        const folded = getFoldedKeys(view.state)
        const missing = extractOutline(view.state)
          .map((i) => foldKey(i.level, i.text))
          .filter((k) => !folded.has(k))
        if (missing.length) view.dispatch({ effects: missing.map((k) => toggleFold.of(k)) })
      }
    },
    {
      id: 'heading.unfoldAll',
      label: t('cmd.unfoldAll'),
      run: () => {
        const folded = getFoldedKeys(view.state)
        if (folded.size) view.dispatch({ effects: expandFolds.of([...folded]) })
      }
    }
  ]
})

// ---- P11 front-matter edit entry ---------------------------------------------

registerContextMenuOps('front-matter', (view, hit) => {
  return [
    {
      id: 'fm.edit',
      label: t('ctx.editFrontMatter'),
      run: () => {
        // Prefer the lezer Frontmatter node; fall back to a leading --- fence.
        let target = enclosingNode(view, hit.pos, ['Frontmatter'])
        if (!target && /^---\s*$/.test(view.state.doc.lineAt(1).text)) {
          let line = 2
          while (line <= view.state.doc.lines) {
            const l = view.state.doc.line(line)
            if (/^---\s*$/.test(l.text) || /^\.\.\.\s*$/.test(l.text)) {
              target = { from: 1, to: l.to, name: 'Frontmatter' }
              break
            }
            line++
          }
        }
        if (!target) return
        view.dispatch({ selection: { anchor: target.from, head: target.to } })
        view.focus()
      }
    }
  ]
})
