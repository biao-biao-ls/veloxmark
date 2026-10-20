import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'
import { getLang, type Lang } from '../i18n'

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
  labelKey: string
  code: string
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

interface TemplateBody {
  body: string
  firstToken: string
}

const TEMPLATE_BODIES: Record<MermaidTemplateId, Record<Lang, TemplateBody>> = {
  flowchart: {
    en: {
      body: `flowchart TD
    %% Note: [] step / {} decision / --> edge; adapt to your own flow
    A[Start] --> B{Condition met?}
    B -->|Yes| C[Handle task]
    B -->|No| D[End]
`,
      firstToken: 'Start'
    },
    zh: {
      body: `flowchart TD
    %% 说明：[] 步骤 / {} 判断 / --> 连线；改成你的流程即可
    A[开始] --> B{条件成立?}
    B -->|是| C[处理任务]
    B -->|否| D[结束]
`,
      firstToken: '开始'
    }
  },
  sequence: {
    en: {
      body: `sequenceDiagram
    %% Note: participant defines a role, ->> solid call, -->> dashed return
    participant C as Client
    participant S as Server
    C->>S: Request
    S-->>C: Response
`,
      firstToken: 'Client'
    },
    zh: {
      body: `sequenceDiagram
    %% 说明：participant 定义角色，->> 实线调用，-->> 虚线返回
    participant C as 客户端
    participant S as 服务端
    C->>S: 请求
    S-->>C: 响应
`,
      firstToken: '客户端'
    }
  },
  class: {
    en: {
      body: `classDiagram
    %% Note: class name { attributes / methods }, <|-- means inheritance
    class Animal {
        +String name
        +eat()
    }
    class Dog
    Animal <|-- Dog
`,
      firstToken: 'Animal'
    },
    zh: {
      body: `classDiagram
    %% 说明：class 名 { 属性 / 方法 }，<|-- 表示继承
    class Animal {
        +String name
        +eat()
    }
    class Dog
    Animal <|-- Dog
`,
      firstToken: 'Animal'
    }
  },
  state: {
    en: {
      body: `stateDiagram-v2
    %% Note: [*] is start/end, --> transition, text after : is the trigger
    [*] --> Pending
    Pending --> InProgress : Start
    InProgress --> [*] : Done
`,
      firstToken: 'Pending'
    },
    zh: {
      body: `stateDiagram-v2
    %% 说明：[*] 是起止状态，--> 转移，冒号后是触发条件
    [*] --> 待处理
    待处理 --> 进行中 : 开始
    进行中 --> [*] : 完成
`,
      firstToken: '待处理'
    }
  },
  er: {
    en: {
      body: `erDiagram
    %% Note: ||--o{ is one-to-many; entity { field } defines attributes
    USER ||--o{ ORDER : places
    USER {
        string name
        string email
    }
`,
      firstToken: 'USER'
    },
    zh: {
      body: `erDiagram
    %% 说明：||--o{ 表示一对多；实体 { 字段 } 定义属性
    USER ||--o{ ORDER : 下单
    USER {
        string name
        string email
    }
`,
      firstToken: 'USER'
    }
  },
  gantt: {
    en: {
      body: `gantt
    %% Note: task : start date, duration; date format comes from the dateFormat line
    title Project Plan
    dateFormat  YYYY-MM-DD
    section Phase 1
    Requirements :a1, 2024-01-01, 7d
    Development :after a1, 14d
`,
      firstToken: 'Project Plan'
    },
    zh: {
      body: `gantt
    %% 说明：任务名 : 开始日期, 时长；日期格式见 dateFormat 行
    title 项目计划
    dateFormat  YYYY-MM-DD
    section 阶段一
    需求梳理 :a1, 2024-01-01, 7d
    开发实现 :after a1, 14d
`,
      firstToken: '项目计划'
    }
  },
  pie: {
    en: {
      body: `pie title Share Example
    %% Note: "label" : value; values are converted to percentages automatically
    "Part A" : 40
    "Part B" : 35
    "Other" : 25
`,
      firstToken: 'Share Example'
    },
    zh: {
      body: `pie title 占比示例
    %% 说明："标签" : 数值，数值会自动换算成百分比
    "部分 A" : 40
    "部分 B" : 35
    "其他" : 25
`,
      firstToken: '占比示例'
    }
  }
}

const TEMPLATE_IDS: MermaidTemplateId[] = [
  'flowchart',
  'sequence',
  'class',
  'state',
  'er',
  'gantt',
  'pie'
]

export function getMermaidTemplates(lang: Lang = getLang()): MermaidTemplate[] {
  return TEMPLATE_IDS.map((id) => {
    const localized = TEMPLATE_BODIES[id][lang] ?? TEMPLATE_BODIES[id].en
    return tpl(id, localized.body, localized.firstToken)
  })
}

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
