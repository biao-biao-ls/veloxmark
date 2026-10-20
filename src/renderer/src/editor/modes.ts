import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { getLivePreviewConfig, livePreviewConfigFacet } from './livePreview'


export const modeClassesExtension = EditorView.editorAttributes.compute(
  [livePreviewConfigFacet],
  (state) => {
    const config = getLivePreviewConfig(state)
    const classes: string[] = []
    if (config.focusMode && config.mode !== 'source') classes.push('cm-focus-mode')
    if (config.typewriterMode) classes.push('cm-typewriter')
    if (config.mode === 'source') classes.push('cm-source-mode')
    return { class: classes.join(' ') }
  }
)

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
        const justEnabled =
          getLivePreviewConfig(u.startState).typewriterMode === false &&
          getLivePreviewConfig(u.state).typewriterMode === true
        if (justEnabled) {
          this.paused = false
          this.schedule()
          return
        }
        // Center only on caret-driven transactions: typing/deleting/arrow keys/clicks/undo
        // explicitly carry a selection or scrollIntoView. Programmatic rewrites from widget
        // interactions (image sizing/centering, table column resize) change the doc without
        // moving the caret — centering those would drag the scroller back to the old caret
        // position (typewriter viewport jumps while editing an image); they must not lift
        // the wheel-scroll pause either.
        const caretDriven = u.transactions.some(
          (tr) => tr.scrollIntoView || tr.selection != null
        )
        if (!caretDriven) return
        if (u.docChanged) this.paused = false
        if (!this.paused) this.schedule()
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
