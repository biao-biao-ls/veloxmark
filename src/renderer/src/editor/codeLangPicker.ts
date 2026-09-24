import hljs from 'highlight.js/lib/common'
import { syntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { t } from '../i18n'

/**
 * 9A: language chip's switcher — readable names (9.3) + common-first searchable
 * list + fence-info rewrite. Three layers, same file shape as table/gridPicker:
 *   - pure: `langDisplayName` / `buildLangItems` / `filterLangs` / `langPickKey`
 *     (unit-tested; hljs is plain JS so vitest node runs it without stubs);
 *   - `switchFenceLang` — event-time re-resolution (stale-instance discipline:
 *     `fenceFrom` is only a hint, the FencedCode node is re-resolved on use);
 *   - `openCodeLangPicker` — DOM singleton popover (ctxMenu/gridPicker pattern).
 *
 * Language names are NEVER translated (CodeLangChip's historical contract) —
 * only `codeLang.*` chrome strings go through i18n.
 */

export interface LangItem {
  id: string
  label: string
}

/** Curated common-first order (canonical hljs ids + mermaid). */
export const LANG_COMMON_IDS = [
  'typescript',
  'javascript',
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'sql',
  'html',
  'css',
  'scss',
  'json',
  'yaml',
  'xml',
  'bash',
  'markdown',
  'mermaid',
  'diff',
  'ini',
  'makefile',
  'dockerfile'
]

/** Non-hljs fence langs the picker still offers (switch TO diagrams). */
const LANG_EXTRA_IDS = ['mermaid']

/**
 * 9.3: readable display name — hljs canonical name (`typescript`/`ts` →
 * `TypeScript`), unknown ids pass through raw (`mermaid`, typos), empty info
 * string reads `text` (CodeBlockWidget label contract).
 */
export function langDisplayName(id: string): string {
  if (!id) return 'text'
  return hljs.getLanguage(id)?.name ?? id
}

/** Pure: common ids first (commonIds order, present ones only), rest alpha by label. */
export function buildLangItems(all: LangItem[], commonIds: string[]): LangItem[] {
  const byId = new Map(all.map((it) => [it.id, it]))
  const seen = new Set<string>()
  const out: LangItem[] = []
  for (const id of commonIds) {
    const it = byId.get(id)
    if (it && !seen.has(it.id)) {
      seen.add(it.id)
      out.push(it)
    }
  }
  const rest = all
    .filter((it) => !seen.has(it.id))
    .sort((a, b) => a.label.localeCompare(b.label))
  return out.concat(rest)
}

/** Pure: case-insensitive substring filter over id and display name. */
export function filterLangs(items: LangItem[], query: string): LangItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter(
    (it) => it.id.toLowerCase().includes(q) || it.label.toLowerCase().includes(q)
  )
}

export type LangKeyOutcome =
  | { kind: 'move'; index: number }
  | { kind: 'pick'; index: number }
  | { kind: 'close' }

/** Pure key semantics for the list: arrows clamp, Enter picks, Esc closes. */
export function langPickKey(key: string, index: number, count: number): LangKeyOutcome | null {
  if (key === 'ArrowDown') return { kind: 'move', index: Math.min(count - 1, index + 1) }
  if (key === 'ArrowUp') return { kind: 'move', index: Math.max(0, index - 1) }
  if (key === 'Enter')
    return count > 0 && index >= 0 && index < count ? { kind: 'pick', index } : null
  if (key === 'Escape') return { kind: 'close' }
  return null
}

/**
 * Rewrite the fence info string of the FencedCode starting at `fenceFrom`.
 * `fenceFrom` is a hint only — the node is re-resolved against the CURRENT
 * tree at event time; a stale hint is a zero-change no-op. Empty info inserts
 * right after the opening CodeMark; picking the current language is a no-op.
 */
export function switchFenceLang(view: EditorView, fenceFrom: number, lang: string): boolean {
  const state = view.state
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(fenceFrom, 1)
  while (node && node.name !== 'FencedCode') node = node.parent
  if (!node) return false
  let openMark: SyntaxNode | null = null
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.name === 'CodeMark') {
      openMark = c
      break
    }
  }
  if (!openMark) return false
  const info = node.getChild('CodeInfo')
  const current = info ? state.sliceDoc(info.from, info.to).trim() : ''
  if (current === lang) return false
  view.dispatch({
    changes: info
      ? { from: info.from, to: info.to, insert: lang }
      : { from: openMark.to, to: openMark.to, insert: lang },
    userEvent: 'input.code.lang'
  })
  return true
}

export interface CodeLangPickerOpts {
  /** Preselect/highlight this lang id (raw fence info). */
  current: string
  onPick: (id: string) => void
}

let openPicker: { el: HTMLElement; teardown: () => void } | null = null

function closePicker(): void {
  if (!openPicker) return
  const { el, teardown } = openPicker
  openPicker = null
  teardown()
  el.remove()
}

function allLangItems(): LangItem[] {
  const ids = [...hljs.listLanguages(), ...LANG_EXTRA_IDS]
  return buildLangItems(
    ids.map((id) => ({ id, label: langDisplayName(id) })),
    LANG_COMMON_IDS
  )
}

/** Open the language picker anchored at `anchor` (closes any previous one). */
export function openCodeLangPicker(anchor: HTMLElement, opts: CodeLangPickerOpts): void {
  closePicker()

  const items = allLangItems()
  let filtered = items
  let index = 0
  const startIndex = items.findIndex((it) => it.id === opts.current)
  if (startIndex >= 0) index = startIndex

  const el = document.createElement('div')
  el.className = 'code-lang-picker'
  el.setAttribute('role', 'listbox')
  el.setAttribute('aria-label', t('codeLang.title'))

  const search = document.createElement('input')
  search.className = 'code-lang-picker-search'
  search.placeholder = t('codeLang.search')
  search.setAttribute('aria-label', t('codeLang.search'))

  const list = document.createElement('div')
  list.className = 'code-lang-picker-list'

  let buttons: HTMLButtonElement[] = []

  const choose = (i: number): void => {
    const it = filtered[i]
    if (!it) return
    closePicker()
    opts.onPick(it.id)
  }

  const paint = (): void => {
    buttons.forEach((b, i) => b.classList.toggle('is-active', i === index))
    buttons[index]?.scrollIntoView({ block: 'nearest' })
  }

  const renderList = (): void => {
    list.textContent = ''
    buttons = []
    if (filtered.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'code-lang-picker-empty'
      empty.textContent = t('codeLang.empty')
      list.appendChild(empty)
      return
    }
    filtered.forEach((it, i) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'list-pick-item'
      b.setAttribute('role', 'option')
      const label = document.createElement('span')
      label.className = 'list-pick-label'
      label.textContent = it.label
      const hint = document.createElement('span')
      hint.className = 'list-pick-hint'
      hint.textContent = it.id
      b.append(label, hint)
      // Keep the press out of the editor (fence touch) and the outside-close.
      b.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
      })
      b.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        choose(i)
      })
      b.addEventListener('mouseenter', () => {
        index = i
        paint()
      })
      buttons.push(b)
      list.appendChild(b)
    })
    paint()
  }

  // Typing filters (input event); keys route through langPickKey — everything
  // else falls through so the caret/characters stay native to the input.
  search.addEventListener('input', () => {
    filtered = filterLangs(items, search.value)
    index = 0
    renderList()
  })
  search.addEventListener('keydown', (e) => {
    const out = langPickKey(e.key, index, filtered.length)
    if (!out) return
    e.preventDefault()
    e.stopPropagation()
    if (out.kind === 'move') {
      index = out.index
      paint()
    } else if (out.kind === 'pick') {
      choose(out.index)
    } else {
      closePicker()
    }
  })

  // Outside mousedown cancels (zero change). Capture phase: runs before the
  // editor handlers under the anchor chip.
  const onOutside = (e: MouseEvent): void => {
    if (e.target instanceof Node && el.contains(e.target)) return
    closePicker()
  }
  document.addEventListener('mousedown', onOutside, true)
  const teardown = (): void => document.removeEventListener('mousedown', onOutside, true)

  el.append(search, list)
  const rect = anchor.getBoundingClientRect()
  const W = 240
  el.style.left = `${Math.max(8, Math.min(rect.right - W, window.innerWidth - W - 8))}px`
  el.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 300)}px`
  document.body.appendChild(el)
  openPicker = { el, teardown }
  renderList()
  search.focus()
}
