/**
 * P16: Mermaid diagram skeletons for the Insert menu.
 *
 * Each template is a complete fenced block (```mermaid … ```) with Chinese
 * guidance comments; `cursorOffset` lands on the first token a user would
 * rename (node label / actor / class name / title).
 */
import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'

export type MermaidTemplateId =
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'gantt'
  | 'pie'

export interface MermaidTemplate {
  id: MermaidTemplateId
  /** i18n key for the picker label. */
  labelKey: string
  /** Full fenced block inserted verbatim at the cursor. */
  code: string
  /** Char offset inside `code` where the cursor should land after insert. */
  cursorOffset: number
}

function tpl(id: MermaidTemplateId, body: string, firstToken: string): MermaidTemplate {
  const normalized = body.endsWith('\n') ? body : `${body}\n`
  const code = '```mermaid\n' + normalized + '```'
  return {
    id,
    labelKey: `mermaid.tpl.${id}`,
    code,
    cursorOffset: code.indexOf(firstToken)
  }
}

export const MERMAID_TEMPLATES: MermaidTemplate[] = [
  tpl(
    'flowchart',
    `flowchart TD
    %% 说明：[] 步骤 / {} 判断 / --> 连线；改成你的流程即可
    A[开始] --> B{条件成立?}
    B -->|是| C[处理任务]
    B -->|否| D[结束]
`,
    '开始'
  ),
  tpl(
    'sequence',
    `sequenceDiagram
    %% 说明：participant 定义角色，->> 实线调用，-->> 虚线返回
    participant C as 客户端
    participant S as 服务端
    C->>S: 请求
    S-->>C: 响应
`,
    '客户端'
  ),
  tpl(
    'class',
    `classDiagram
    %% 说明：class 名 { 属性 / 方法 }，<|-- 表示继承
    class Animal {
        +String name
        +eat()
    }
    class Dog
    Animal <|-- Dog
`,
    'Animal'
  ),
  tpl(
    'state',
    `stateDiagram-v2
    %% 说明：[*] 是起止状态，--> 转移，冒号后是触发条件
    [*] --> 待处理
    待处理 --> 进行中 : 开始
    进行中 --> [*] : 完成
`,
    '待处理'
  ),
  tpl(
    'er',
    `erDiagram
    %% 说明：||--o{ 表示一对多；实体 { 字段 } 定义属性
    USER ||--o{ ORDER : 下单
    USER {
        string name
        string email
    }
`,
    'USER'
  ),
  tpl(
    'gantt',
    `gantt
    %% 说明：任务名 : 开始日期, 时长；日期格式见 dateFormat 行
    title 项目计划
    dateFormat  YYYY-MM-DD
    section 阶段一
    需求梳理 :a1, 2024-01-01, 7d
    开发实现 :after a1, 14d
`,
    '项目计划'
  ),
  tpl(
    'pie',
    `pie title 占比示例
    %% 说明："标签" : 数值，数值会自动换算成百分比
    "部分 A" : 40
    "部分 B" : 35
    "其他" : 25
`,
    '占比示例'
  )
]

/**
 * True when the main cursor sits inside a ```mermaid fence. The Insert
 * command is a no-op then (P16: 首版直接不动作) — editing the existing
 * source is always better than nesting another fence.
 */
export function isCursorInMermaidFence(state: EditorState): boolean {
  let node: SyntaxNode | null = syntaxTree(state).resolveInner(state.selection.main.head, -1)
  while (node) {
    if (node.name === 'FencedCode') {
      const info = node.getChild('CodeInfo')
      const lang = info ? state.sliceDoc(info.from, info.to).trim() : ''
      return lang === 'mermaid'
    }
    node = node.parent
  }
  return false
}
