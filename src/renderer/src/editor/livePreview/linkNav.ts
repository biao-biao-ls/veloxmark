import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { t } from '../../i18n'
import { getLivePreviewConfig } from './config'

/**
 * P17: link navigation primitives.
 *
 * Modifier-click handling lives in `linkNavExtension` (editor-level
 * domEventHandlers — mark decorations cannot carry listeners). Existence
 * results are cached in a module Map keyed `${baseDir}\n${href}`; the App
 * revalidates on watcher/save/focus and bumps linkEpoch when anything flips
 * (handlers.ts reads the same cache to pick cm-md-link-broken).
 *
 * Pure exports (extractLinkUrl / collectLinkHrefs / cache ops) are DOM-less
 * at call time so vitest can import this module in node.
 */

// ---- href extraction ---------------------------------------------------------

const EXTERNAL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/

/** URL carried by a Link / URL / Autolink node; null when unresolvable. */
export function extractLinkUrl(state: EditorState, node: SyntaxNode): string | null {
  if (node.name === 'URL' || node.name === 'Autolink') {
    return state.sliceDoc(node.from, node.to).replace(/^<|>$/g, '') || null
  }
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.name === 'URL') {
      const url = state.sliceDoc(c.from, c.to).replace(/^<|>$/g, '')
      return url || null
    }
  }
  // Fallback for odd shapes: parse the raw markdown text.
  const text = state.sliceDoc(node.from, node.to)
  const m = /\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/.exec(text)
  return m && m[1] ? m[1] : null
}

/** Every href in the document (Link + Autolink nodes, document order). */
export function collectLinkHrefs(state: EditorState): string[] {
  const out: string[] = []
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'Link' || node.name === 'Autolink') {
        const url = extractLinkUrl(state, node.node)
        if (url) out.push(url)
      }
    }
  })
  return out
}

// ---- existence cache ---------------------------------------------------------

/** hrefs we skip in existence checks (schemes + in-doc anchors). */
export function isSkippableHref(href: string): boolean {
  return EXTERNAL_SCHEME_RE.test(href) || href.startsWith('#')
}

const brokenCache = new Map<string, boolean>()

function cacheKey(baseDir: string, href: string): string {
  return `${baseDir}\n${href}`
}

export function isBrokenCached(baseDir: string, href: string): boolean {
  return brokenCache.get(cacheKey(baseDir, href)) === true
}

/**
 * Record `href`'s existence status. Returns true when the broken flag
 * actually flipped — callers bump linkEpoch only then.
 */
export function rememberLinkStatus(baseDir: string, href: string, exists: boolean): boolean {
  const key = cacheKey(baseDir, href)
  const next = !exists
  if (brokenCache.get(key) === next) return false
  brokenCache.set(key, next)
  return true
}

export function clearLinkCache(): void {
  brokenCache.clear()
}

/** Broken hrefs recorded for `baseDir` (e2e / debugging). */
export function getBrokenHrefs(baseDir: string): string[] {
  const out: string[] = []
  for (const [key, broken] of brokenCache) {
    if (!broken) continue
    const sep = key.indexOf('\n')
    if (sep < 0) continue
    if (key.slice(0, sep) === baseDir) out.push(key.slice(sep + 1))
  }
  return out
}

// ---- navigation bus + tooltip resolver ---------------------------------------

type LinkNavHandler = (href: string, baseDir: string) => void
type LinkTipResolver = (href: string, baseDir: string) => Promise<string>

let navHandler: LinkNavHandler | null = null
let tipResolver: LinkTipResolver | null = null

export function setLinkNavHandler(fn: LinkNavHandler | null): void {
  navHandler = fn
}

export function setLinkTipResolver(fn: LinkTipResolver | null): void {
  tipResolver = fn
}

// ---- hover tooltip (editor-level singleton, lazy DOM) ------------------------

let tooltipEl: HTMLDivElement | null = null
let lastTipHref: string | null = null
const tipTextCache = new Map<string, string>()

function ensureTooltip(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null
  if (tooltipEl && tooltipEl.isConnected) return tooltipEl
  tooltipEl = document.createElement('div')
  tooltipEl.className = 'vm-link-tooltip'
  tooltipEl.hidden = true
  document.body.appendChild(tooltipEl)
  return tooltipEl
}

function hideTooltip(): void {
  lastTipHref = null
  if (tooltipEl) tooltipEl.hidden = true
}

async function resolveTipText(baseDir: string, href: string): Promise<string> {
  const key = cacheKey(baseDir, href)
  const cached = tipTextCache.get(key)
  if (cached != null) return cached
  let text = href
  try {
    if (tipResolver) {
      text = await tipResolver(href, baseDir)
    } else if (typeof window !== 'undefined' && window.api?.resolveLink) {
      const res = await window.api.resolveLink(baseDir, href)
      if (res.kind === 'external') text = res.absPath ?? href
      else if (res.kind === 'broken') text = t('link.brokenTip')
      else if (res.kind === 'file' || res.kind === 'dir')
        text = res.absPath + (res.anchor ? ` #${res.anchor}` : '')
      else if (res.kind === 'anchor') text = `#${res.anchor ?? ''}`
    }
  } catch {
    text = href
  }
  tipTextCache.set(key, text)
  return text
}

export function invalidateLinkTipCache(): void {
  tipTextCache.clear()
}

function linkNodeAt(state: EditorState, pos: number): SyntaxNode | null {
  const tree = syntaxTree(state)
  let node: SyntaxNode | null = tree.resolveInner(pos, -1)
  for (; node; node = node.parent) {
    if (node.name === 'Link' || node.name === 'URL' || node.name === 'Autolink') return node
  }
  node = tree.resolveInner(pos, 1)
  for (; node; node = node.parent) {
    if (node.name === 'Link' || node.name === 'URL' || node.name === 'Autolink') return node
  }
  return null
}

function platformModifier(event: MouseEvent): boolean {
  const isMac =
    typeof window !== 'undefined' && window.api ? window.api.platform === 'darwin' : false
  return isMac ? event.metaKey : event.ctrlKey
}

/** Modifier-click navigates; plain click stays a cursor placement (P17). */
export const linkNavExtension = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!platformModifier(event)) return false
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos == null) return false
    const node = linkNodeAt(view.state, pos)
    if (!node) return false
    const href = extractLinkUrl(view.state, node)
    if (!href) return false
    event.preventDefault()
    const baseDir = getLivePreviewConfig(view.state).baseDir
    navHandler?.(href, baseDir)
    return true
  },
  mousemove(event, view) {
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos == null) {
      hideTooltip()
      return false
    }
    // Only react when the hit point sits on a rendered link span.
    const el = document.elementFromPoint(event.clientX, event.clientY)
    const span = el?.closest?.('.cm-md-link') as HTMLElement | null
    if (!span) {
      hideTooltip()
      return false
    }
    const node = linkNodeAt(view.state, pos)
    if (!node) {
      hideTooltip()
      return false
    }
    const href = extractLinkUrl(view.state, node)
    if (!href) {
      hideTooltip()
      return false
    }
    const tip = ensureTooltip()
    if (!tip) return false
    const baseDir = getLivePreviewConfig(view.state).baseDir
    const key = cacheKey(baseDir, href)
    const broken = isBrokenCached(baseDir, href) && !isSkippableHref(href)
    const immediate = broken ? t('link.brokenTip') : (tipTextCache.get(key) ?? href)
    tip.textContent = immediate
    tip.hidden = false
    tip.style.left = `${Math.min(event.clientX + 12, window.innerWidth - 24)}px`
    tip.style.top = `${Math.min(event.clientY + 18, window.innerHeight - 40)}px`
    if (lastTipHref !== key) {
      lastTipHref = key
      if (!broken && !tipTextCache.has(key)) {
        void resolveTipText(baseDir, href).then((text) => {
          // Only replace if this tip is still the hovered one.
          if (lastTipHref === key && tooltipEl && !tooltipEl.hidden) {
            tooltipEl.textContent = text
          }
        })
      }
    }
    return false
  },
  mouseleave() {
    hideTooltip()
    return false
  }
})
