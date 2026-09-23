/**
 * wave⑤ block-delta context-menu registrations (P05/P06/P11/P16/P18/P21/P24).
 *
 * Each factory receives the shared (view, hit, rt) triple at menu-open time
 * and returns block-specific items; the registry assembles them above the
 * generic cut/copy/paste skeleton. Ops re-read doc/DOM at click time (stale-
 * instance discipline). ids are the e2e contract — probes key on data-op.
 *
 * View helpers live in blockHelpers.ts (task 4.3 = 2.17) — registrations only.
 */
import { t } from '../../i18n'
import { copyPngImage, exportPng, exportSvg } from '../mermaid'
import {
  expandFolds,
  foldKey,
  getFoldedKeys,
  headingAtPos,
  toggleFold
} from '../livePreview/fold'
import { extractOutline } from '../../outline/extract'
import { parseCalloutMarker } from '../livePreview/callout'
import {
  confirmDanger,
  deleteRange,
  enclosingNode,
  fenceBody,
  indentFenceBody,
  indentSelectedLines,
  mathRange,
  mermaidSvgAt
} from './blockHelpers'
import { registerContextMenuOps } from './registry'
import type { CtxMenuItem } from './types'

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
