import type { MermaidBodies } from './types'

export const BODIES_ZH: MermaidBodies = {
  flowchart: {
    body: `flowchart TD
    %% 说明：[] 步骤 / {} 判断 / --> 连线；改成你的流程即可
    A[开始] --> B{条件成立?}
    B -->|是| C[处理任务]
    B -->|否| D[结束]
`,
    firstToken: '开始'
  },
  sequence: {
    body: `sequenceDiagram
    %% 说明：participant 定义角色，->> 实线调用，-->> 虚线返回
    participant C as 客户端
    participant S as 服务端
    C->>S: 请求
    S-->>C: 响应
`,
    firstToken: '客户端'
  },
  class: {
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
  },
  state: {
    body: `stateDiagram-v2
    %% 说明：[*] 是起止状态，--> 转移，冒号后是触发条件
    [*] --> 待处理
    待处理 --> 进行中 : 开始
    进行中 --> [*] : 完成
`,
    firstToken: '待处理'
  },
  er: {
    body: `erDiagram
    %% 说明：||--o{ 表示一对多；实体 { 字段 } 定义属性
    USER ||--o{ ORDER : 下单
    USER {
        string name
        string email
    }
`,
    firstToken: 'USER'
  },
  gantt: {
    body: `gantt
    %% 说明：任务名 : 开始日期, 时长；日期格式见 dateFormat 行
    title 项目计划
    dateFormat  YYYY-MM-DD
    section 阶段一
    需求梳理 :a1, 2024-01-01, 7d
    开发实现 :after a1, 14d
`,
    firstToken: '项目计划'
  },
  pie: {
    body: `pie title 占比示例
    %% 说明："标签" : 数值，数值会自动换算成百分比
    "部分 A" : 40
    "部分 B" : 35
    "其他" : 25
`,
    firstToken: '占比示例'
  }
}
