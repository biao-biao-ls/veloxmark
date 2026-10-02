/**
 * P27 editor context-menu framework — shared types.
 *
 * The menu surface is pure presentation: items carry an id (data-op), an
 * already-translated label and a zero-argument run. Block detection lives in
 * detect.ts; item construction in registry.ts; the DOM host in
 * components/EditorContextMenu.tsx.
 */
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
  /** Stable op id — `data-op` in the DOM; the e2e contract keys on it. */
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  checked?: boolean
  danger?: boolean
  separator?: boolean
  /** FE-04 语义分组标题行（非交互，键盘跳过——isNavLandable 判定）。 */
  groupTitle?: string
  submenu?: CtxMenuItem[]
  run?: () => void
}

export interface CtxMenuState {
  x: number
  y: number
  items: CtxMenuItem[]
  /** 设计稿限高上限（表格菜单 480px）；不传则用视口公式。 */
  maxHeightCap?: number
  /**
   * 打开手势通道（FE-04 r2 打开即预选定性）：'keyboard'（Shift+F10/Menu 键）
   * 打开时首项默认激活（与 IT-02/FE-05 菜单键盘通道「首项默认激活」一致）；
   * 'pointer'（右键/⋮ 点击，默认）打开时静息无预选——高亮只来自真实 hover
   * 或键盘导航（见 keyboardNav.openActiveIndex，Menu/MenuBar 同型同口径）。
   */
  via?: 'pointer' | 'keyboard'
}

export interface CtxRuntime {
  runCommand: (id: string) => void
  /** P22-F3: unified menu disabled state — command isDisabled() at menu build. */
  isCommandDisabled?: (id: string) => boolean
  /** wave⑤ block deltas: resolve relative image srcs against the active doc. */
  getBaseDir?: () => string
  getActiveFilePath?: () => string | null
  /**
   * GLB toast:action — message + optional action button. Method syntax keeps
   * legacy `(message: string) => void` call sites/implementations assignable
   * (string shorthand = no-action form).
   */
  toast(input: ToastInput): void
  clipboardWrite: (text: string) => Promise<void>
  openLink: (href: string) => void
  /**
   * FE-11 P2-2 (Dialog live-relabel, DialogKeyedCopy 同型)：key 与预烘焙串二选一。
   * 传 `*Key` 时 Dialog 渲染侧按当前语言即时求 t()——打开中的确认框随语言切换
   * 换字；传串则冻结为调用时语言（既有 call site 兼容面）。
   */
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
