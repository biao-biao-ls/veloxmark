import type { MermaidBodies } from './types'

export const BODIES_PT: MermaidBodies = {
  flowchart: {
    body: `flowchart TD
    %% Nota: [] etapa / {} decisão / --> aresta; adapte ao seu próprio fluxo
    A[Início] --> B{Condição atendida?}
    B -->|Sim| C[Tratar tarefa]
    B -->|Não| D[Fim]
`,
    firstToken: 'Início'
  },
  sequence: {
    body: `sequenceDiagram
    %% Nota: participant define um papel, ->> chamada sólida, -->> retorno tracejado
    participant C as Cliente
    participant S as Servidor
    C->>S: Requisição
    S-->>C: Resposta
`,
    firstToken: 'Cliente'
  },
  class: {
    body: `classDiagram
    %% Nota: nome da classe { atributos / métodos }, <|-- significa herança
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
    %% Nota: [*] é início/fim, --> transição, o texto após : é o gatilho
    [*] --> Pendente
    Pendente --> EmAndamento : Iniciar
    EmAndamento --> [*] : Concluir
`,
    firstToken: 'Pendente'
  },
  er: {
    body: `erDiagram
    %% Nota: ||--o{ é um-para-muitos; entidade { campo } define atributos
    USER ||--o{ ORDER : realiza
    USER {
        string name
        string email
    }
`,
    firstToken: 'USER'
  },
  gantt: {
    body: `gantt
    %% Nota: tarefa : data de início, duração; o formato de data vem da linha dateFormat
    title Plano do Projeto
    dateFormat  YYYY-MM-DD
    section Fase 1
    Requisitos :a1, 2024-01-01, 7d
    Desenvolvimento :after a1, 14d
`,
    firstToken: 'Plano do Projeto'
  },
  pie: {
    body: `pie title Exemplo de Participação
    %% Nota: "rótulo" : valor; os valores são convertidos em porcentagens automaticamente
    "Parte A" : 40
    "Parte B" : 35
    "Outro" : 25
`,
    firstToken: 'Exemplo de Participação'
  }
}
