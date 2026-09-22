/**
 * P27 editor context-menu framework — shared types.
 *
 * The menu surface is pure presentation: items carry an id (data-op), an
 * already-translated label and a zero-argument run. Block detection lives in
 * detect.ts; item construction in registry.ts; the DOM host in
 * components/EditorContextMenu.tsx.
 */

export type BlockKind =
  | 'paragraph'
  | 'heading'
  | 'list-ul'
  | 'list-ol'
  | 'task-item'
  | 'task-checkbox'
  | 'blockquote'
  | 'table-cell'
  | 'code-block'
  | 'math-block'
  | 'math-inline'
  | 'mermaid'
  | 'callout'
  | 'front-matter'
  | 'footnote-ref'
  | 'link'
  | 'image'
  | 'empty'

export interface TableSpan {
  from: number
  to: number
  row: number
  col: number
}

export interface BlockHit {
  kind: BlockKind
  pos: number
  lineFrom: number
  lineTo: number
  headingLevel?: number
  href?: string
  checked?: boolean
  table?: TableSpan
}

export interface CtxMenuItem {
  /** Stable op id — `data-op` in the DOM; the e2e contract keys on it. */
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  checked?: boolean
  danger?: boolean
  separator?: boolean
  submenu?: CtxMenuItem[]
  run?: () => void
}

export interface CtxMenuState {
  x: number
  y: number
  items: CtxMenuItem[]
}

export interface CtxRuntime {
  runCommand: (id: string) => void
  /** P22-F3: unified menu disabled state — command isDisabled() at menu build. */
  isCommandDisabled?: (id: string) => boolean
  /** wave⑤ block deltas: resolve relative image srcs against the active doc. */
  getBaseDir?: () => string
  getActiveFilePath?: () => string | null
  toast: (message: string) => void
  clipboardWrite: (text: string) => Promise<void>
  openLink: (href: string) => void
  confirm: (opts: {
    title?: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    danger?: boolean
  }) => Promise<boolean>
}
