import type { ToastInput } from '../../hooks/useToast'

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
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  checked?: boolean
  danger?: boolean
  separator?: boolean
  groupTitle?: string
  submenu?: CtxMenuItem[]
  run?: () => void
}

export interface CtxMenuState {
  x: number
  y: number
  items: CtxMenuItem[]
  maxHeightCap?: number
  via?: 'pointer' | 'keyboard'
}

export interface CtxRuntime {
  runCommand: (id: string) => void
  isCommandDisabled?: (id: string) => boolean
  getBaseDir?: () => string
  getActiveFilePath?: () => string | null
  toast(input: ToastInput): void
  clipboardWrite: (text: string) => Promise<void>
  openLink: (href: string) => void
  confirm: (opts: {
    title?: string
    message?: string
    titleKey?: string
    messageKey?: string
    messageParams?: Record<string, string | number>
    confirmLabel?: string
    cancelLabel?: string
    confirmLabelKey?: string
    cancelLabelKey?: string
    danger?: boolean
  }) => Promise<boolean>
}
