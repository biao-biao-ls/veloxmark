import { syntaxTree } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { t } from '../i18n'
import { getCtxRuntime } from './contextMenu/registry'
import { assertWritable } from './readOnlyGuard'

interface ParsedLink {
  kind: 'auto' | 'inline'
  destFrom: number
  destTo: number
  dest: string
}

const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/
const ANGLE_WRAP_RE = /[ \t\n()\\<>]/
const WS_RE = /\s/

export function isValidLinkHref(href: string): boolean {
  if (href.trim() === '') return false
  if (CONTROL_CHAR_RE.test(href)) return false
  return !href.includes('<') && !href.includes('>')
}

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
  return i === text.length ? i : -1
}

function parseLink(text: string): ParsedLink | null {
  if (text.startsWith('<')) {
    const m = /^<([^<>\s]+)>$/.exec(text)
    if (!m) return null
    return { kind: 'auto', destFrom: 1, destTo: text.length - 1, dest: m[1] }
  }
  if (!text.startsWith('[')) return null

  const anchorEnd = scanAnchorEnd(text)
  if (anchorEnd < 0) return null
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

function renderLinkDest(href: string): string {
  return ANGLE_WRAP_RE.test(href) ? `<${href}>` : href
}

export function extractHrefFromLinkText(text: string): string | null {
  const parsed = parseLink(text)
  if (!parsed) return null
  return parsed.dest === '' ? null : parsed.dest
}

export function rewriteLinkHref(text: string, href: string): string | null {
  if (!isValidLinkHref(href)) return null
  const parsed = parseLink(text)
  if (!parsed) return null
  if (parsed.kind === 'auto') {
    if (/\s/.test(href)) return null
    return `<${href}>`
  }
  return text.slice(0, parsed.destFrom) + renderLinkDest(href) + text.slice(parsed.destTo)
}


function linkNodeAtView(view: EditorView, pos: number): SyntaxNode | null {
  let node: SyntaxNode | null = syntaxTree(view.state).resolveInner(pos, 1)
  while (node && node.name !== 'Link' && node.name !== 'Autolink') node = node.parent
  return node
}

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

export async function applyLinkEditAtAnchor(anchor: HTMLElement, newHref: string): Promise<boolean> {
  try {
    const view = EditorView.findFromDOM(anchor)
    if (!view) return false
    return await applyLinkEdit(view, view.posAtDOM(anchor), newHref)
  } catch {
    return false
  }
}
