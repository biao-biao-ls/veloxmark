import type { MermaidBodies } from './types'

export const BODIES_JA: MermaidBodies = {
  flowchart: {
    body: `flowchart TD
    %% 注: [] 手順 / {} 判断 / --> 結線; 自分のフローに合わせて変更してください
    A[開始] --> B{条件を満たす?}
    B -->|はい| C[タスクを処理]
    B -->|いいえ| D[終了]
`,
    firstToken: '開始'
  },
  sequence: {
    body: `sequenceDiagram
    %% 注: participant で役割を定義、->> 実線の呼び出し、-->> 破線の応答
    participant C as クライアント
    participant S as サーバー
    C->>S: リクエスト
    S-->>C: レスポンス
`,
    firstToken: 'クライアント'
  },
  class: {
    body: `classDiagram
    %% 注: class 名 { 属性 / メソッド }、<|-- は継承
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
    %% 注: [*] は開始/終了、--> は遷移、: の後ろはトリガー
    [*] --> 未着手
    未着手 --> 進行中 : 開始
    進行中 --> [*] : 完了
`,
    firstToken: '未着手'
  },
  er: {
    body: `erDiagram
    %% 注: ||--o{ は 1 対多; 実体 { フィールド } で属性を定義
    USER ||--o{ ORDER : 注文
    USER {
        string name
        string email
    }
`,
    firstToken: 'USER'
  },
  gantt: {
    body: `gantt
    %% 注: タスク名 : 開始日, 期間; 日付形式は dateFormat 行に従う
    title プロジェクト計画
    dateFormat  YYYY-MM-DD
    section フェーズ 1
    要件整理 :a1, 2024-01-01, 7d
    開発実装 :after a1, 14d
`,
    firstToken: 'プロジェクト計画'
  },
  pie: {
    body: `pie title 構成比の例
    %% 注: "ラベル" : 値; 値は自動的に百分率に変換される
    "部分 A" : 40
    "部分 B" : 35
    "その他" : 25
`,
    firstToken: '構成比の例'
  }
}
