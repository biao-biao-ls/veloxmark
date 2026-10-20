import { syntaxTree } from '@codemirror/language'
import { markdownLanguage } from '@codemirror/lang-markdown'
import type { ChangeSpec, EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { getEditingAssists } from './config'


const URL_RE = /^(https?:\/\/|mailto:|xmpp:|www\.)\S+$/
const nonPlainText = /code|horizontalrule|html|link|comment|processing|escape|entity|image|mark|url/i

function normalizeUrl(url: string): string {
  return /^www\./.test(url) ? 'https://' + url : url
}

function isPlainRange(state: EditorState, from: number, to: number): boolean {
  if (!markdownLanguage.isActiveAt(state, from, 1)) return false
  let crosses = false
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (node.from > from || nonPlainText.test(node.name)) crosses = true
    },
    leave: (node) => {
      if (node.to < to) crosses = true
    }
  })
  return !crosses
}

export function transformPaste(state: EditorState, text: string): ChangeSpec[] | null {
  if (!getEditingAssists(state).enabled) return null
  const url = text.trim()
  if (!URL_RE.test(url)) return null
  const link = normalizeUrl(url)

  const main = state.selection.main
  if (!main.empty && isPlainRange(state, main.from, main.to)) {
    const selected = state.sliceDoc(main.from, main.to)
    return [{ from: main.from, to: main.to, insert: `[${selected}](${link})` }]
  }
  if (main.empty && getEditingAssists(state).wrapBareUrlOnPaste) {
    return state.selection.ranges.map((range) => ({
      from: range.from,
      to: range.to,
      insert: `<${link}>`
    }))
  }
  return null
}

export function pasteEventHandler(event: ClipboardEvent, view: EditorView): boolean {
  const text = event.clipboardData?.getData('text/plain')
  if (!text) return false
  const changes = transformPaste(view.state, text)
  if (!changes) return false
  event.preventDefault()
  view.dispatch({ changes, userEvent: 'input.paste', scrollIntoView: true })
  return true
}
