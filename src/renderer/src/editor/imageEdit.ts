/**
 * ren-image:write-md — .md 图片语法写回（IT-03 FE-04）。
 *
 * 尺寸与对齐一律落源码语法（非显示态旁路）：
 *   尺寸 = Typora/pandoc `=WxH` 像素槽（复用 P05 既有口径，不新增尺寸语法）
 *   对齐 = `{align=left|center|right}` brace 后缀（与既有 `{flip=}` 同口径补齐）
 *
 * 写回是**外科式**的：只重写被改动的槽位，其余字节（alt/src/title/flip/对齐）
 * 原样保留——这是「尺寸改写保对齐 / 对齐改写保尺寸」判据的实现基础。
 * 每次写回一次 dispatch，undo 边界 = 单次编辑（AC-OP-13）。
 */
import { syntaxTree } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { t } from '../i18n'
import { getCtxRuntime } from './contextMenu/registry'
import { parseImageMarkdown, type ImageAlign, type ImageFlip, type ParsedImage } from './image-parse'
import { assertWritable } from './readOnlyGuard'

export type { ImageAlign, ImageFlip, ParsedImage } from './image-parse'

/**
 * Surgical split around the two mutable slots:
 *   1 = prefix through src/title · 2 = optional `=WxH` · 3 = close paren · 4 = attr tail
 * The tail is permissive (`{…}` of any key) only to tolerate the reordering of
 * *known* groups (align/flip) — `parseImageMarkdown` rejects unknown `{key=}`
 * groups up-front, so an unknown-group round-trip path is not reachable here.
 */
const IMAGE_SPLIT_RE =
  /^(!\[[^\]]*\]\(\s*[^)\s]+(?:\s+"[^"]*")?)(\s+=\s*\d+[xX]\d+)?(\s*\))((?:\{[^{}]*\})*)$/

interface ImageParts {
  prefix: string
  sizeSlot: string
  close: string
  tail: string
}

function splitImage(text: string): ImageParts | null {
  if (!parseImageMarkdown(text)) return null
  const m = IMAGE_SPLIT_RE.exec(text)
  if (!m) return null
  return { prefix: m[1], sizeSlot: m[2] ?? '', close: m[3], tail: m[4] ?? '' }
}

/**
 * Test-only round-trip mirror: reassembles a full image string from parsed
 * pieces for assertions. Production write-backs never call this — they go
 * through the surgical rewriteImage* writers (untouched bytes preserved).
 */
export function renderImageMarkdown(image: ParsedImage): string {
  const titlePart = image.title != null ? ` "${image.title}"` : ''
  const sizePart =
    image.width != null && image.height != null ? ` =${image.width}x${image.height}` : ''
  const flipPart = image.flip ? `{flip=${image.flip}}` : ''
  const alignPart = image.align ? `{align=${image.align}}` : ''
  return `![${image.alt}](${image.src}${titlePart}${sizePart})${flipPart}${alignPart}`
}

/**
 * Rewrite only the `=WxH` size slot; null clears it. Align/flip/title/src/alt
 * bytes are untouched. Returns null when the text is not a parseable image.
 */
export function rewriteImageSize(
  text: string,
  size: { width: number; height: number } | null
): string | null {
  const parts = splitImage(text)
  if (!parts) return null
  const sizePart = size ? ` =${size.width}x${size.height}` : ''
  return parts.prefix + sizePart + parts.close + parts.tail
}

/** Drop every `{key=…}` group for one key, re-append a fresh one when given. */
function patchAttrTail(tail: string, key: 'align' | 'flip', value: string | null): string {
  const groups = tail.match(/\{[^{}]*\}/g) ?? []
  const kept = groups.filter((group) => !group.startsWith(`{${key}=`))
  if (value) kept.push(`{${key}=${value}}`)
  return kept.join('')
}

/**
 * Rewrite only the `{align=…}` group; null clears it. Size/flip/title/src/alt
 * bytes are untouched. Returns null when the text is not a parseable image.
 */
export function rewriteImageAlign(text: string, align: ImageAlign | null): string | null {
  const parts = splitImage(text)
  if (!parts) return null
  return parts.prefix + parts.sizeSlot + parts.close + patchAttrTail(parts.tail, 'align', align)
}

/**
 * Rewrite only the `{flip=…}` group; null clears it. Size/align/title/src/alt
 * bytes are untouched (P05 zoom toolbar's flip buttons share this writer).
 */
export function rewriteImageFlip(text: string, flip: ImageFlip | null): string | null {
  const parts = splitImage(text)
  if (!parts) return null
  return parts.prefix + parts.sizeSlot + parts.close + patchAttrTail(parts.tail, 'flip', flip)
}

/**
 * src 槽位承载力：IMAGE_MARKDOWN_RE 的 src 是 `[^)\s]+`——空串、空白、`)`
 * 与控制字符（会截断 mdres 等底层协议路径）一律拒绝。
 */
export function isValidImageSrc(src: string): boolean {
  if (src === '' || /[\s)]/.test(src)) return false
  for (let i = 0; i < src.length; i++) {
    const code = src.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return false
  }
  return true
}

/** prefix 里可外科替换的 src 槽：`](` 后至第一个空白/`)` 前。 */
const SRC_IN_PREFIX_RE = /^(!\[[^\]]*\]\(\s*)([^)\s]+)/

/**
 * Rewrite only the destination src slot (broken-image「编辑地址」修复入口).
 * Alt/title/size/align/flip bytes are untouched — same surgical discipline as
 * the size/align/flip writers. Returns null when the text is not a parseable
 * image or the new src cannot be carried by the bare-dest slot.
 */
export function rewriteImageSrc(text: string, newSrc: string): string | null {
  if (!isValidImageSrc(newSrc)) return null
  const parts = splitImage(text)
  if (!parts) return null
  const m = SRC_IN_PREFIX_RE.exec(parts.prefix)
  if (!m) return null
  return (
    m[1] + newSrc + parts.prefix.slice(m[0].length) + parts.sizeSlot + parts.close + parts.tail
  )
}

/** Size/align/flip/src patch applied by the float (and by the P05 zoom toolbar). */
export interface ImageEditPatch {
  width?: number | null
  height?: number | null
  align?: ImageAlign | null
  flip?: ImageFlip | null
  /** New destination src (broken-image「编辑地址」写回). */
  src?: string
}

export type ImageEditKind = 'size' | 'align' | 'flip' | 'src'

/**
 * Receipt toast per edit kind. flip/src deliberately have none — P05's flip
 * toggles predate the render-zone receipt family and the broken-image src
 * fix is a repair entry, neither is in the frozen key set (i18n.test.ts locks
 * `render.toast.*` to exactly four keys, PEND-15).
 */
const RECEIPT_KEY_BY_KIND: Record<ImageEditKind, string | null> = {
  size: 'render.toast.imageSize',
  align: 'render.toast.imageAlign',
  flip: null,
  src: null
}

const USER_EVENT_BY_KIND: Record<ImageEditKind, string> = {
  size: 'input.image.resize',
  align: 'input.image.align',
  flip: 'input.image.flip',
  src: 'input.image.editSrc'
}

/**
 * Single write-back gate for image syntax edits: read-only pre-check (AC-ERR-08
 * — never dispatch, never half-commit), resolve the live Image node, rewrite the
 * source string, dispatch one transaction (undo = one step) and fire the
 * matching receipt toast.
 *
 * Resolves the node through the syntax tree rather than trusting a captured
 * offset, so the write-back survives intermediate edits (stale-instance
 * discipline, same as table/widget.ts).
 */
export async function applyImageEdit(
  view: EditorView,
  sourceFrom: number,
  patch: ImageEditPatch,
  kind: ImageEditKind
): Promise<boolean> {
  // Never rejects: callers fire-and-forget (`void applyImageEditAtAnchor(...)`),
  // so a thrown IPC/syntax error would surface as an unhandled rejection and
  // silently drop the UI's follow-up state sync. Refusal is always `false`.
  try {
    return await applyImageEditInner(view, sourceFrom, patch, kind)
  } catch {
    return false
  }
}

async function applyImageEditInner(
  view: EditorView,
  sourceFrom: number,
  patch: ImageEditPatch,
  kind: ImageEditKind
): Promise<boolean> {
  if (!(await assertWritable())) return false

  const state = view.state
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(sourceFrom, 1)
  while (node && node.name !== 'Image') node = node.parent
  if (!node) return false

  const current = state.sliceDoc(node.from, node.to)
  if (!parseImageMarkdown(current)) return false

  let next: string | null
  if (kind === 'align') {
    next = rewriteImageAlign(current, patch.align ?? null)
  } else if (kind === 'flip') {
    next = rewriteImageFlip(current, patch.flip ?? null)
  } else if (kind === 'src') {
    next = patch.src != null ? rewriteImageSrc(current, patch.src) : null
  } else {
    // Size writes are explicit: both dimensions present writes `=WxH`, anything
    // less clears the slot. Callers derive both from the natural aspect.
    const width = patch.width ?? null
    const height = patch.height ?? null
    next = rewriteImageSize(current, width != null && height != null ? { width, height } : null)
  }
  if (next === null || next === current) return false

  view.dispatch({
    changes: { from: node.from, to: node.to, insert: next },
    userEvent: USER_EVENT_BY_KIND[kind]
  })
  const receiptKey = RECEIPT_KEY_BY_KIND[kind]
  if (receiptKey) getCtxRuntime()?.toast(t(receiptKey))
  return true
}

/**
 * Float entry point: locate the EditorView and the document position of an
 * image widget's DOM node, then run the shared write-back gate. DOM-derived
 * position beats a captured offset (which goes stale the moment an earlier
 * region of the document changes length).
 */
export async function applyImageEditAtAnchor(
  anchor: HTMLElement,
  patch: ImageEditPatch,
  kind: ImageEditKind
): Promise<boolean> {
  try {
    const view = EditorView.findFromDOM(anchor)
    if (!view) return false
    return await applyImageEdit(view, view.posAtDOM(anchor), patch, kind)
  } catch {
    return false
  }
}

/**
 * Live src of the image behind an anchor DOM node (broken-image「编辑地址」
 * prefill). Re-parses the syntax tree at action time — the widget DOM may
 * predate the latest source rewrite (stale-instance discipline, like
 * `hrefAtAnchor` in linkEdit).
 */
export function imageSrcAtAnchor(anchor: HTMLElement): string | null {
  try {
    const view = EditorView.findFromDOM(anchor)
    if (!view) return null
    let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(view.posAtDOM(anchor), 1)
    while (node && node.name !== 'Image') node = node.parent
    if (!node) return null
    return parseImageMarkdown(view.state.sliceDoc(node.from, node.to))?.src ?? null
  } catch {
    return null
  }
}
