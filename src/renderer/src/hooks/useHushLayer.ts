import { useEffect } from 'react'
import { EditorView } from '@codemirror/view'
import { focusEditorBody } from '../editor/contextMenu/popup'
import { exitCodeEdit, isCodeEditActive } from '../editor/codeEdit'
import { exitMathEdit, isMathEditActive } from '../editor/mathEdit'
import { chromeState } from '../editor/table/chromeState'
import { hoverDiscipline } from './useHoverDiscipline'

export type HushTier = 'modal' | 'menu' | 'chrome'

export interface HushLayer {
  id: string
  tier: HushTier
  close(): void
  owns?(target: unknown): boolean
  isAlive?(): boolean
}

export interface BlockEditHandle {
  close(): void
}

export interface HushDeps {
  isModalOpen(): boolean
  hasChrome?(): boolean
  collapseChrome?(): void
  blockEdit?(): BlockEditHandle | null
  focusBody(): void
}

export type HushConsume = 'modal' | 'collapse' | 'none'

export interface HushLayerStore {
  register(layer: HushLayer): () => void
  consumeTop(): HushConsume
  collapseAll(): void
  layerIds(): string[]
  isLayerTarget(target: unknown): boolean
}

export function createHushLayerStore(deps: HushDeps): HushLayerStore {
  const layers = new Map<string, HushLayer>()

  function prune(): void {
    for (const [id, layer] of [...layers]) {
      if (layer.isAlive && !layer.isAlive()) layers.delete(id)
    }
  }

  function topmostModal(): HushLayer | null {
    let top: HushLayer | null = null
    for (const layer of layers.values()) if (layer.tier === 'modal') top = layer
    return top
  }

  function register(layer: HushLayer): () => void {
    layers.set(layer.id, layer)
    return () => {
      if (layers.get(layer.id) === layer) layers.delete(layer.id)
    }
  }

  function collapseAll(): void {
    prune()
    const open = [...layers.values()]
    layers.clear()
    for (let i = open.length - 1; i >= 0; i--) {
      try {
        open[i].close()
      } catch {
      }
    }
    const be = deps.blockEdit?.() ?? null
    if (be) {
      try {
        be.close()
      } catch {
      }
    }
    if (open.length > 0 || be) deps.focusBody()
    deps.collapseChrome?.()
  }

  function consumeTop(): HushConsume {
    prune()
    const modal = topmostModal()
    if (modal) {
      layers.delete(modal.id)
      try {
        modal.close()
      } catch {
      }
      return 'modal'
    }
    if (deps.isModalOpen()) return 'modal'
    if (layers.size > 0 || deps.hasChrome?.() || deps.blockEdit?.() != null) {
      collapseAll()
      return 'collapse'
    }
    return 'none'
  }

  return {
    register,
    consumeTop,
    collapseAll,
    layerIds: () => {
      prune()
      return [...layers.keys()]
    },
    isLayerTarget(target: unknown) {
      prune()
      for (const layer of layers.values()) {
        if (layer.owns && layer.owns(target)) return true
      }
      return false
    }
  }
}


let modalProbe: () => boolean = () => false

export function setModalProbe(probe: () => boolean): void {
  modalProbe = probe
}

function currentBlockEdit(): BlockEditHandle | null {
  if (typeof document === 'undefined') return null
  const root = document.querySelector('.cm-editor')
  const view = root ? EditorView.findFromDOM(root as HTMLElement) : null
  if (!view) return null
  if (isMathEditActive(view)) return { close: () => exitMathEdit(view) }
  if (isCodeEditActive(view)) return { close: () => exitCodeEdit(view) }
  return null
}

export const hushLayers = createHushLayerStore({
  isModalOpen: () => modalProbe(),
  hasChrome: () =>
    hoverDiscipline.getSnapshot().active !== null || chromeState.getSnapshot().microVisible,
  collapseChrome: () => {
    hoverDiscipline.hideAllNow()
    chromeState.hush()
  },
  blockEdit: currentBlockEdit,
  focusBody: () => {
    if (typeof document !== 'undefined') focusEditorBody()
  }
})


const TABLE_REGION_SEL = '.cm-md-table-outer, .cm-md-table-toolbar'
const BODY_REGION_SEL = '.cm-editor'
const BLOCK_EDIT_SEL = [
  '.cm-md-math-block',
  '[class*="cm-md-math-src"]',
  '.cm-md-math-preview',
  '.cm-md-math-edit-chip',
  '.cm-md-code-block',
  '[class*="cm-md-code-src"]',
  '.cm-md-mermaid',
  '.cm-md-mermaid-preview'
].join(', ')

function isBodyBlankTarget(target: unknown, store: HushLayerStore): boolean {
  if (!(target instanceof Element)) return false
  if (store.isLayerTarget(target)) return false
  if (target.closest(TABLE_REGION_SEL)) return false
  if (target.closest(BLOCK_EDIT_SEL)) return false
  return target.closest(BODY_REGION_SEL) != null
}

export function attachHushDomListeners(store: HushLayerStore): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    if (event.defaultPrevented) return
    if (store.consumeTop() === 'none') return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const onMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return
    if (!isBodyBlankTarget(event.target, store)) return
    store.consumeTop()
  }
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('mousedown', onMouseDown)
  return () => {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('mousedown', onMouseDown)
  }
}

export function useHushLayer(): void {
  useEffect(() => attachHushDomListeners(hushLayers), [])
}
