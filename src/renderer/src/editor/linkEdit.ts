/**
 * ren-link:edit-url — 链接 URL 编辑的纯语法层（IT-03，外科式改写）。
 *
 * 为什么是纯模块：URL 改写只依赖 Markdown 源码字符串本身，与 CM6 无关——
 * 单测可直接覆盖解析/写回的全部字节级契约，apply 层（找节点、dispatch）后挂。
 *
 * 写回是**外科式**的：只重写 destination 槽位的字节，锚文本（含 `\]` 转义、
 * 嵌套 `[b]`、嵌套图片 `[![alt](img.png)]`）与 title 槽位（`"…" / '…' / (…)`）
 * 一律原样保留——这是「改 URL 不碰其它槽位」判据的实现基础。
 *
 * 解析纪律（与判据一一对应）：
 *   - 只认**完整**链接：链接必须在文本末尾结束，`[t](a) trailing` 一律拒绝；
 *   - 非链接拒绝：`[t][ref]`（`]` 后不是 `(`）、`![img](a)`（图片非链接）、纯文本；
 *   - 裸 destination 用括号深度扫描承载平衡括号 `a(b)`；
 *   - `<dest>` 尖括号形式提取时剥壳、写回时按需再上壳。
 */
import { syntaxTree } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { t } from '../i18n'
import { getCtxRuntime } from './contextMenu/registry'
import { assertWritable } from './readOnlyGuard'

/** 链接/自动链接的解析结果：destination 在原文中的槽位 + 提取出的 href。 */
interface ParsedLink {
  /** `auto` = `<url>` 自动链接；`inline` = `[text](dest)` 内联链接。 */
  kind: 'auto' | 'inline'
  /** destination 槽位起点（含 `<` 壳；空 dest 时为零宽位置）。 */
  destFrom: number
  /** destination 槽位终点（含 `>` 壳）。 */
  destTo: number
  /** 提取到的 href（尖括号已剥壳）；空 dest 时为 `''`。 */
  dest: string
}

const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/
/** 需要尖括号 destination 才能承载的字节（空格/括号/反斜杠/尖括号/换行）。 */
const ANGLE_WRAP_RE = /[ \t\n()\\<>]/
const WS_RE = /\s/

/**
 * href 合法性：去空白后非空、无控制字符（U+0000-U+001F、U+007F）、无 `<`/`>`。
 * 控制字符会截断/注入底层协议路径，尖括号会破坏 destination 语法——一律拒绝。
 */
export function isValidLinkHref(href: string): boolean {
  if (href.trim() === '') return false
  if (CONTROL_CHAR_RE.test(href)) return false
  return !href.includes('<') && !href.includes('>')
}

/** 扫描锚文本：转义 `\x` 跳过一字节，`[`/`]` 按深度配对，深度归零处收口。 */
function scanAnchorEnd(text: string): number {
  let depth = 1
  let i = 1
  while (i < text.length) {
    const c = text[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === '[') depth++
    else if (c === ']') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

/** 裸 destination：平衡括号深度扫描，遇未转义空白或深度归零的 `)` 收口。 */
function scanBareDest(text: string, from: number): number {
  let depth = 0
  let i = from
  while (i < text.length) {
    const c = text[i]
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === '(') depth++
    else if (c === ')') {
      if (depth === 0) return i
      depth--
    } else if (WS_RE.test(c)) return i
    i++
  }
  return i
}

/**
 * 消费 destination 之后的可选 title 槽与收尾 `)`。
 * 只做合法性判定（外科改写不触碰这些字节），失败返回 -1。
 */
function scanTitleAndClose(text: string, from: number): number {
  let i = from
  while (i < text.length && WS_RE.test(text[i])) i++

  const c = text[i]
  if (c === '"' || c === "'") {
    i++
    while (i < text.length && text[i] !== c) {
      if (text[i] === '\\') i++
      i++
    }
    if (text[i] !== c) return -1
    i++
  } else if (c === '(') {
    let depth = 1
    i++
    while (i < text.length && depth > 0) {
      if (text[i] === '\\') {
        i += 2
        continue
      }
      if (text[i] === '(') depth++
      else if (text[i] === ')') depth--
      i++
    }
    if (depth !== 0) return -1
  }

  while (i < text.length && WS_RE.test(text[i])) i++
  if (text[i] !== ')') return -1
  i++
  // 完整链接判据：链接必须在文本末尾结束，尾随垃圾一律拒绝。
  return i === text.length ? i : -1
}

/**
 * 解析完整链接/自动链接（非链接、残缺、尾随垃圾均返回 null）。
 * 内联链接的锚文本按括号深度扫描，因此 `\]` 转义、嵌套 `[b]`、
 * 嵌套图片 `[![alt](img.png)]` 都只结束于**最外层** `]`。
 */
function parseLink(text: string): ParsedLink | null {
  if (text.startsWith('<')) {
    // 自动链接 `<url>`：内部不允许空白与尖括号，整体必须收口于 `>`。
    const m = /^<([^<>\s]+)>$/.exec(text)
    if (!m) return null
    return { kind: 'auto', destFrom: 1, destTo: text.length - 1, dest: m[1] }
  }
  if (!text.startsWith('[')) return null

  const anchorEnd = scanAnchorEnd(text)
  if (anchorEnd < 0) return null
  // `[t][ref]` 判据：`]` 后必须紧跟 `(`，否则不是内联链接。
  if (text[anchorEnd + 1] !== '(') return null

  let i = anchorEnd + 2
  while (i < text.length && WS_RE.test(text[i])) i++
  const destFrom = i

  let destTo: number
  let dest: string
  if (text[i] === '<') {
    let j = i + 1
    while (j < text.length && text[j] !== '>') {
      if (text[j] === '\\') j++
      j++
    }
    if (text[j] !== '>') return null
    destTo = j + 1
    dest = text.slice(i + 1, j)
  } else {
    destTo = scanBareDest(text, i)
    dest = text.slice(i, destTo)
  }

  if (scanTitleAndClose(text, destTo) < 0) return null
  return { kind: 'inline', destFrom, destTo, dest }
}

/**
 * destination 写回形态：含空格/括号/反斜杠等裸形式无法安全承载的字节时
 * 上尖括号壳，否则写裸形式（与 CommonMark 裸 dest 规则同口径）。
 */
function renderLinkDest(href: string): string {
  return ANGLE_WRAP_RE.test(href) ? `<${href}>` : href
}

/**
 * 从完整链接/自动链接字符串提取 href（尖括号 dest 剥壳）。
 * 空 destination（`[t]()` / `[t](  )`）返回 null——「无 URL」不是可提取值。
 */
export function extractHrefFromLinkText(text: string): string | null {
  const parsed = parseLink(text)
  if (!parsed) return null
  return parsed.dest === '' ? null : parsed.dest
}

/**
 * 外科式重写完整链接的 destination 槽位；锚文本与 title 槽字节原样保留。
 * 返回 null 的拒绝面：href 非法（空/控制字符/尖括号）、text 不是完整链接、
 * 自动链接形态无法承载的新 href（含空白——`<a b>` 不是自动链接）。
 */
export function rewriteLinkHref(text: string, href: string): string | null {
  if (!isValidLinkHref(href)) return null
  const parsed = parseLink(text)
  if (!parsed) return null
  if (parsed.kind === 'auto') {
    // 自动链接内部禁空白/尖括号，bare 形态承载不了就整条拒绝（不静默降级）。
    if (/\s/.test(href)) return null
    return `<${href}>`
  }
  return text.slice(0, parsed.destFrom) + renderLinkDest(href) + text.slice(parsed.destTo)
}

// ── apply 层（CM6 写回闸，FE-05）────────────────────────────────────

/** 语法树解析 Link/Autolink 节点（不信捕获 offset，stale 纪律）。 */
function linkNodeAtView(view: EditorView, pos: number): SyntaxNode | null {
  let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(pos, 1)
  while (node && node.name !== 'Link' && node.name !== 'Autolink') node = node.parent
  return node
}

/** 从锚点 DOM 活体读出当前 href（写回后锚点复用时的真源）。 */
export function hrefAtAnchor(anchor: HTMLElement): string | null {
  try {
    const view = EditorView.findFromDOM(anchor)
    if (!view) return null
    const node = linkNodeAtView(view, view.posAtDOM(anchor))
    if (!node) return null
    return extractHrefFromLinkText(view.state.sliceDoc(node.from, node.to))
  } catch {
    return null
  }
}

/**
 * 单写回闸：只读前置（AC-ERR-08，永不 dispatch 半提交）→ 语法树定位 →
 * 单事务 dispatch（undo=单次编辑）→ 回执 toast。永不 reject（fire-and-forget）。
 */
export async function applyLinkEdit(
  view: EditorView,
  sourceFrom: number,
  newHref: string
): Promise<boolean> {
  try {
    if (!(await assertWritable())) return false
    const node = linkNodeAtView(view, sourceFrom)
    if (!node) return false
    const current = view.state.sliceDoc(node.from, node.to)
    const next = rewriteLinkHref(current, newHref)
    if (next === null || next === current) return false
    view.dispatch({
      changes: { from: node.from, to: node.to, insert: next },
      userEvent: 'input.link.editUrl'
    })
    getCtxRuntime()?.toast(t('render.toast.linkUpdated'))
    return true
  } catch {
    return false
  }
}

/** 浮层入口：DOM 派生定位 → 共享写回闸。 */
export async function applyLinkEditAtAnchor(anchor: HTMLElement, newHref: string): Promise<boolean> {
  try {
    const view = EditorView.findFromDOM(anchor)
    if (!view) return false
    return await applyLinkEdit(view, view.posAtDOM(anchor), newHref)
  } catch {
    return false
  }
}
