import { syntaxTree } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { t } from '../i18n'
import { getCtxRuntime } from './contextMenu/registry'
import { parseImageMarkdown, type ImageAlign, type ImageFlip, type ParsedImage } from './image-parse'
import { assertWritable } from './readOnlyGuard'

export type { ImageAlign, ImageFlip, ParsedImage } from './image-parse'

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

export function renderImageMarkdown(image: ParsedImage): string {
  const titlePart = image.title != null ? ` "${image.title}"` : ''
  const sizePart =
    image.width != null && image.height != null ? ` =${image.width}x${image.height}` : ''
  const flipPart = image.flip ? `{flip=${image.flip}}` : ''
  const alignPart = image.align ? `{align=${image.align}}` : ''
  return `![${image.alt}](${image.src}${titlePart}${sizePart})${flipPart}${alignPart}`
}

export function rewriteImageSize(
  text: string,
  size: { width: number; height: number } | null
): string | null {
  const parts = splitImage(text)
  if (!parts) return null
  const sizePart = size ? ` =${size.width}x${size.height}` : ''
  return parts.prefix + sizePart + parts.close + parts.tail
}

function patchAttrTail(tail: string, key: 'align' | 'flip', value: string | null): string {
  const groups = tail.match(/\{[^{}]*\}/g) ?? []
  const kept = groups.filter((group) => !group.startsWith(`{${key}=`))
  if (value) kept.push(`{${key}=${value}}`)
  return kept.join('')
}

export function rewriteImageAlign(text: string, align: ImageAlign | null): string | null {
  const parts = splitImage(text)
  if (!parts) return null
  return parts.prefix + parts.sizeSlot + parts.close + patchAttrTail(parts.tail, 'align', align)
}

export function rewriteImageFlip(text: string, flip: ImageFlip | null): string | null {
  const parts = splitImage(text)
  if (!parts) return null
  return parts.prefix + parts.sizeSlot + parts.close + patchAttrTail(parts.tail, 'flip', flip)
}

export function isValidImageSrc(src: string): boolean {
  if (src === '' || /[\s)]/.test(src)) return false
  for (let i = 0; i < src.length; i++) {
    const code = src.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return false
  }
  return true
}

const SRC_IN_PREFIX_RE = /^(!\[[^\]]*\]\(\s*)([^)\s]+)/

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

export interface ImageEditPatch {
  width?: number | null
  height?: number | null
  align?: ImageAlign | null
  flip?: ImageFlip | null
  src?: string
}

export type ImageEditKind = 'size' | 'align' | 'flip' | 'src'

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

export async function applyImageEdit(
  view: EditorView,
  sourceFrom: number,
  patch: ImageEditPatch,
  kind: ImageEditKind
): Promise<boolean> {
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
