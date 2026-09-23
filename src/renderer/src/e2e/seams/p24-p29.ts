/**
 * P24 + P28 + P29 e2e seams — code-block display, focused code-block panel,
 * and focused syntax-highlight handles (task 1A split).
 *
 * All three share ONE effect in App.tsx (same viewRef/fileOps deps; one
 * code-block-adjacent probe surface) and keep sharing it here — do not split
 * into three effects. Effect body moved verbatim from App.tsx (dep array kept
 * as-is). The two identical `themeToken` bodies dedupe to the module-private
 * `probeThemeToken` helper (spec 1A: same-file behavior-equivalent dedupe;
 * everything else is a pure move).
 * Contract: e2e/handles.d.ts `__veloxP24` / `__veloxP28` / `__veloxP29`.
 */
import { useEffect } from 'react'
import { undo } from '@codemirror/commands'
import { getCodeBlockExpanded, toggleCodeBlockFold } from '../../editor/livePreview/codeBlockUi'
import { getPreferences, setPreferences } from '../../preferences/store'
import type { FileOps, ViewRef } from './types'

export interface P24P29Deps {
  viewRef: ViewRef
  fileOps: FileOps
}

export function useP24P29Seam(deps: P24P29Deps): void {
  const { viewRef, fileOps } = deps
  // P24 e2e handle — code-block display seams.
  useEffect(() => {
    const info = () => {
      const blocks = Array.from(document.querySelectorAll('.cm-md-code-block'))
      if (blocks.length === 0) return null
      const block = blocks[0]
      const expander = block.querySelector('.cm-md-code-expander')
      const codeEl = block.querySelector('pre code')
      // Numbered mode renders one span per line (no \n text nodes); fall back
      // to textContent splitting for the plain pre-render path.
      const numbered = codeEl ? codeEl.querySelectorAll('.cm-md-code-line').length : 0
      const textNodes = codeEl ? codeEl.textContent ?? '' : ''
      return {
        count: blocks.length,
        collapsedCount: document.querySelectorAll('.cm-md-code-block-collapsed').length,
        expanderText: expander ? expander.textContent : null,
        hasFoldBtn: Array.from(document.querySelectorAll('.cm-md-block-toolbar-btn')).some(
          (b) => b.textContent && b.textContent !== 'Copy' && b.textContent !== '✓'
        ),
        lineNoCount: document.querySelectorAll('.cm-md-code-line-no').length,
        wrapCount: document.querySelectorAll('.cm-md-code-block-wrap').length,
        renderedCodeLines: numbered > 0 ? numbered : textNodes.length === 0 ? 0 : textNodes.split('\n').length,
        hasCollapsedClass: block.classList.contains('cm-md-code-block-collapsed')
      }
    }
    window.__veloxP24 = {
      getDoc: () => viewRef.current?.state.doc.toString() ?? '',
      loadDoc: (text, path) => fileOps.loadContent(text, path),
      setPrefs: (patch) => setPreferences(patch),
      getPrefs: () => {
        const p = getPreferences()
        return {
          codeBlockCollapseLines: p.codeBlockCollapseLines,
          codeBlockShowLineNumbers: p.codeBlockShowLineNumbers,
          codeBlockWrap: p.codeBlockWrap
        }
      },
      getExpandedKeys: () => {
        const view = viewRef.current
        return view ? Array.from(getCodeBlockExpanded(view.state)) : []
      },
      clearExpanded: () => {
        const view = viewRef.current
        if (!view) return
        const keys = Array.from(getCodeBlockExpanded(view.state))
        if (keys.length === 0) return
        view.dispatch({ effects: keys.map((key) => toggleCodeBlockFold.of({ key, expanded: false })) })
      },
      codeBlockInfo: info,
      clickExpander: () => {
        const btn = document.querySelector('.cm-md-code-expander')
        if (!btn) return false
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        return true
      },
      clickFold: () => {
        const btns = Array.from(document.querySelectorAll('.cm-md-block-toolbar-btn'))
        // Fold is the first toolbar button on expanded long blocks (before Copy).
        const fold = btns.find((b) => b.textContent && b.textContent !== 'Copy' && b.textContent !== '✓')
        if (!fold) return false
        fold.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        return true
      }
    }
    // P28 e2e handle — focused code-block panel seams. Shares this effect with
    // __veloxP24 (same viewRef/fileOps deps; code-block-adjacent probe surface).
    window.__veloxP28 = {
      getDoc: () => viewRef.current?.state.doc.toString() ?? '',
      loadDoc: (text, path) => fileOps.loadContent(text, path),
      setCursor: (pos) => {
        const view = viewRef.current
        if (!view) return
        const p = Math.min(Math.max(0, pos), view.state.doc.length)
        view.dispatch({ selection: { anchor: p } })
      },
      getCursor: () => viewRef.current?.state.selection.main.head ?? 0,
      insertText: (pos, text) => {
        const view = viewRef.current
        if (!view) return
        const p = Math.min(Math.max(0, pos), view.state.doc.length)
        view.dispatch({
          changes: { from: p, insert: text },
          selection: { anchor: p + text.length }
        })
      },
      undo: () => {
        const view = viewRef.current
        return view ? undo(view) : false
      },
      panelInfo: () => {
        const srcLines = document.querySelectorAll('.cm-line.cm-md-code-src')
        const firstLine = document.querySelector('.cm-line.cm-md-code-src-first')
        const chip = document.querySelector('.cm-md-code-src-chip')
        let fenceTextVisible = false
        srcLines.forEach((el) => {
          if ((el.textContent ?? '').includes('```')) fenceTextVisible = true
        })
        return {
          panelLineCount: srcLines.length,
          hasFirst: !!firstLine,
          hasLast: !!document.querySelector('.cm-line.cm-md-code-src-last'),
          bodyCount: document.querySelectorAll('.cm-line.cm-md-code-src-body').length,
          chipCount: document.querySelectorAll('.cm-md-code-src-chip').length,
          chipText: chip?.textContent ?? null,
          fenceTextVisible,
          openLineHasFence: (firstLine?.textContent ?? '').includes('```'),
          widgetCount: document.querySelectorAll('.cm-md-code-block').length,
          mermaidWidgetCount: document.querySelectorAll('.cm-md-mermaid').length,
          focusModeOn: !!document.querySelector('.cm-editor.cm-focus-mode'),
          activeLineCount: document.querySelectorAll('.cm-line.cm-focus-active').length,
          previewPanelVisible: (() => {
            const p = document.querySelector('.mermaid-preview-panel')
            return !!p && (p as HTMLElement).offsetParent !== null
          })(),
          panelLeft: firstLine?.getBoundingClientRect().left ?? null,
          styles: firstLine
            ? (() => {
                const cs = getComputedStyle(firstLine)
                return {
                  bg: cs.backgroundColor,
                  borderLeft: cs.borderLeftColor,
                  borderTop: cs.borderTopColor,
                  radius: cs.borderTopLeftRadius,
                  opacity: cs.opacity
                }
              })()
            : null
        }
      },
      themeToken: (name) => probeThemeToken(name)
    }
    // P29 e2e handle — focused-panel syntax highlight seams. Shares this
    // effect with __veloxP24/__veloxP28 (same viewRef/fileOps deps).
    window.__veloxP29 = {
      getDoc: () => viewRef.current?.state.doc.toString() ?? '',
      loadDoc: (text, path) => fileOps.loadContent(text, path),
      setCursor: (pos) => {
        const view = viewRef.current
        if (!view) return
        const p = Math.min(Math.max(0, pos), view.state.doc.length)
        view.dispatch({ selection: { anchor: p } })
      },
      getCursor: () => viewRef.current?.state.selection.main.head ?? 0,
      insertText: (pos, text) => {
        const view = viewRef.current
        if (!view) return
        const p = Math.min(Math.max(0, pos), view.state.doc.length)
        view.dispatch({
          changes: { from: p, insert: text },
          selection: { anchor: p + text.length }
        })
      },
      undo: () => {
        const view = viewRef.current
        return view ? undo(view) : false
      },
      tokenInfo: () => {
        const panelLines = document.querySelectorAll('.cm-line.cm-md-code-src')
        const tokenEls = document.querySelectorAll(
          '.cm-line.cm-md-code-src [class*="hljs-"]'
        )
        const classes = new Set<string>()
        const keywordTexts: string[] = []
        let panelKeywordColor: string | null = null
        tokenEls.forEach((el) => {
          el.classList.forEach((c) => {
            if (c.startsWith('hljs-')) classes.add(c)
          })
          if (el.classList.contains('hljs-keyword')) {
            keywordTexts.push(el.textContent ?? '')
            if (!panelKeywordColor) panelKeywordColor = getComputedStyle(el).color
          }
        })
        const chip = document.querySelector('.cm-md-code-src-chip')
        let fenceTextVisible = false
        panelLines.forEach((el) => {
          if ((el.textContent ?? '').includes('```')) fenceTextVisible = true
        })
        const widgetKw = document.querySelector('.cm-md-code-block .hljs-keyword')
        return {
          panelLineCount: panelLines.length,
          chipText: chip?.textContent ?? null,
          fenceTextVisible,
          widgetCount: document.querySelectorAll('.cm-md-code-block').length,
          spanCount: tokenEls.length,
          classes: Array.from(classes),
          keywordTexts,
          panelKeywordColor,
          widgetKeywordColor: widgetKw ? getComputedStyle(widgetKw).color : null
        }
      },
      themeToken: (name) => probeThemeToken(name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileOps])
}

/** Shared P28/P29 themeToken body (dedupe sanctioned by spec 1A). */
function probeThemeToken(name: string): string {
  // Token-scope host is .app (theme class lives there, not on :root) —
  // resolve under it so light/dark samples read the right vocabulary.
  const host = document.querySelector('.app') ?? document.documentElement
  const probe = document.createElement('span')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  host.appendChild(probe)
  probe.style.background = `var(${name})`
  const resolved = getComputedStyle(probe).backgroundColor
  probe.remove()
  return resolved
}
