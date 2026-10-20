import type { MermaidBodies } from './types'

export const BODIES_EN: MermaidBodies = {
  flowchart: {
    body: `flowchart TD
    %% Note: [] step / {} decision / --> edge; adapt to your own flow
    A[Start] --> B{Condition met?}
    B -->|Yes| C[Handle task]
    B -->|No| D[End]
`,
    firstToken: 'Start'
  },
  sequence: {
    body: `sequenceDiagram
    %% Note: participant defines a role, ->> solid call, -->> dashed return
    participant C as Client
    participant S as Server
    C->>S: Request
    S-->>C: Response
`,
    firstToken: 'Client'
  },
  class: {
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
  state: {
    body: `stateDiagram-v2
    %% Note: [*] is start/end, --> transition, text after : is the trigger
    [*] --> Pending
    Pending --> InProgress : Start
    InProgress --> [*] : Done
`,
    firstToken: 'Pending'
  },
  er: {
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
  gantt: {
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
  pie: {
    body: `pie title Share Example
    %% Note: "label" : value; values are converted to percentages automatically
    "Part A" : 40
    "Part B" : 35
    "Other" : 25
`,
    firstToken: 'Share Example'
  }
}
