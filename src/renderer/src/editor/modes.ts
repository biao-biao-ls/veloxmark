import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { getLivePreviewConfig, livePreviewConfigFacet } from './livePreview'

/**
 * P08 view-mode plumbing.
 *
 * Mode state lives in the live-preview config facet (so it follows the same
 * Compartment-reconfigure path as theme/baseDir); these extensions only react
 * to it: CSS classes on the editor root, and the typewriter scroll behavior.
 */

/** Attach cm-focus-mode / cm-typewriter / cm-source-mode to the editor root. */
export const modeClassesExtension = EditorView.editorAttributes.compute(
  [livePreviewConfigFacet],
  (state) => {
    const config = getLivePreviewConfig(state)
    const classes: string[] = []
    // Focus decorations only exist in live mode (build.ts returns none for
    // source) — without this guard the dim CSS would grey the whole doc.
    if (config.focusMode && config.mode !== 'source') classes.push('cm-focus-mode')
    if (config.typewriterMode) classes.push('cm-typewriter')
    if (config.mode === 'source') classes.push('cm-source-mode')
    // Attrs values must be strings — an empty class attr is a no-op.
    return { class: classes.join(' ') }
  }
)

/**
 * Typewriter mode: after each cursor move/edit, scroll so the cursor line
 * sits at the viewport's vertical center.
 *
 * Two CM6 realities shape this implementation:
 *
 * - "User scrolled" is detected via wheel/touch *intent* events, not scroll
 *   events. CodeMirror itself scrolls on many transactions (scrollIntoView
 *   effects, cursor-out-of-view), and those scroll events are
 *   indistinguishable from the user's — reacting to them would pause the
 *   mode permanently after the first Enter.
 * - Centering runs on the next animation frame, not inside update(). CM
 *   applies its own scroll effects after plugins see the update, so a
 *   synchronous scrollTop tweak gets immediately overridden.
 */
export function typewriterExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      private paused = false
      private raf = 0
      private readonly onUserScroll: () => void

      constructor(private readonly view: EditorView) {
        this.onUserScroll = () => {
          this.paused = true
        }
        view.scrollDOM.addEventListener('wheel', this.onUserScroll, { passive: true })
        view.scrollDOM.addEventListener('touchstart', this.onUserScroll, { passive: true })
      }

      update(u: ViewUpdate): void {
        if (!getLivePreviewConfig(u.state).typewriterMode) {
          this.paused = false
          this.cancel()
          return
        }
        if (u.docChanged) this.paused = false
        // Turning the mode on centers immediately (config-only transaction).
        const justEnabled =
          getLivePreviewConfig(u.startState).typewriterMode === false &&
          getLivePreviewConfig(u.state).typewriterMode === true
        if (justEnabled || ((u.selectionSet || u.docChanged) && !this.paused)) this.schedule()
      }

      destroy(): void {
        this.view.scrollDOM.removeEventListener('wheel', this.onUserScroll)
        this.view.scrollDOM.removeEventListener('touchstart', this.onUserScroll)
        this.cancel()
      }

      private schedule(): void {
        if (this.raf) return
        this.raf = requestAnimationFrame(() => {
          this.raf = 0
          this.center()
        })
      }

      private cancel(): void {
        if (this.raf) cancelAnimationFrame(this.raf)
        this.raf = 0
      }

      private center(): void {
        const { view } = this
        const head = view.state.selection.main.head
        const coords = view.coordsAtPos(head)
        if (!coords) return
        const sc = view.scrollDOM
        const mid = sc.getBoundingClientRect().top + sc.clientHeight / 2
        const delta = (coords.top + coords.bottom) / 2 - mid
        if (Math.abs(delta) < 1) return
        sc.scrollTop += delta
      }
    }
  )
}
