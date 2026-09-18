import { describe, expect, it } from 'vitest'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { MERMAID_TEMPLATES, isCursorInMermaidFence } from './mermaidTemplates'

const FIRST_TOKENS: Record<string, string> = {
  flowchart: '开始',
  sequence: '客户端',
  class: 'Animal',
  state: '待处理',
  er: 'USER',
  gantt: '项目计划',
  pie: '占比示例'
}

function stateWith(doc: string, head: number): EditorState {
  const state = EditorState.create({
    doc,
    selection: { anchor: head },
    extensions: [markdown()]
  })
  ensureSyntaxTree(state, state.doc.length, 30000)
  return state
}

describe('mermaidTemplates (P16)', () => {
  it('ships 7 templates with unique ids', () => {
    expect(MERMAID_TEMPLATES).toHaveLength(7)
    const ids = MERMAID_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(7)
  })

  it('every template is a complete mermaid fence with a Chinese guidance comment', () => {
    for (const tpl of MERMAID_TEMPLATES) {
      expect(tpl.code.startsWith('```mermaid\n')).toBe(true)
      expect(tpl.code.endsWith('```')).toBe(true)
      expect(tpl.code).toContain('%%')
      // Comment text is Chinese (at least one CJK char after %%).
      const commentLine = tpl.code.split('\n').find((l) => l.includes('%%')) ?? ''
      expect(commentLine).toMatch(/[一-鿿]/)
    }
  })

  it('cursorOffset lands on the first editable token of each template', () => {
    for (const tpl of MERMAID_TEMPLATES) {
      const token = FIRST_TOKENS[tpl.id]
      expect(token, `missing expectation for ${tpl.id}`).toBeTruthy()
      expect(tpl.cursorOffset).toBeGreaterThan(0)
      expect(tpl.code.slice(tpl.cursorOffset).startsWith(token as string)).toBe(true)
    }
  })

  it('label keys follow the mermaid.tpl.<id> pattern', () => {
    for (const tpl of MERMAID_TEMPLATES) {
      expect(tpl.labelKey).toBe(`mermaid.tpl.${tpl.id}`)
    }
  })
})

describe('isCursorInMermaidFence (P16)', () => {
  const fenceDoc = 'intro\n\n```mermaid\nflowchart TD\n    A[开始] --> B\n```\n\nafter\n'

  it('true when the cursor is inside a mermaid fence body', () => {
    const head = fenceDoc.indexOf('flowchart TD') + 3
    expect(isCursorInMermaidFence(stateWith(fenceDoc, head))).toBe(true)
  })

  it('false when the cursor is outside any fence', () => {
    expect(isCursorInMermaidFence(stateWith(fenceDoc, 2))).toBe(false)
    expect(isCursorInMermaidFence(stateWith(fenceDoc, fenceDoc.indexOf('after')))).toBe(false)
  })

  it('false inside a non-mermaid fence', () => {
    const doc = '```js\nconst x = 1\n```\n'
    const state = stateWith(doc, doc.indexOf('const') + 2)
    expect(isCursorInMermaidFence(state)).toBe(false)
  })
})
