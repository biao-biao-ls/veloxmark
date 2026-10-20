import type { MermaidBodies } from './types'

export const BODIES_ES: MermaidBodies = {
  flowchart: {
    body: `flowchart TD
    %% Nota: [] paso / {} decisión / --> conexión; adapta tu propio flujo
    A[Inicio] --> B{¿Condición cumplida?}
    B -->|Sí| C[Gestionar tarea]
    B -->|No| D[Fin]
`,
    firstToken: 'Inicio'
  },
  sequence: {
    body: `sequenceDiagram
    %% Nota: participant define un rol, ->> llamada continua, -->> retorno discontinuo
    participant C as Cliente
    participant S as Servidor
    C->>S: Solicitud
    S-->>C: Respuesta
`,
    firstToken: 'Cliente'
  },
  class: {
    body: `classDiagram
    %% Nota: nombre de clase { atributos / métodos }, <|-- significa herencia
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
    %% Nota: [*] es inicio/fin, --> transición, el texto después de : es el disparador
    [*] --> Pendiente
    Pendiente --> EnProgreso : Inicio
    EnProgreso --> [*] : Fin
`,
    firstToken: 'Pendiente'
  },
  er: {
    body: `erDiagram
    %% Nota: ||--o{ es uno-a-muchos; entidad { campo } define atributos
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
    %% Nota: tarea : fecha de inicio, duración; el formato de fecha viene de la línea dateFormat
    title Plan del proyecto
    dateFormat  YYYY-MM-DD
    section Fase 1
    Requisitos :a1, 2024-01-01, 7d
    Desarrollo :after a1, 14d
`,
    firstToken: 'Plan del proyecto'
  },
  pie: {
    body: `pie title Ejemplo de proporción
    %% Nota: "etiqueta" : valor; los valores se convierten en porcentajes automáticamente
    "Parte A" : 40
    "Parte B" : 35
    "Otro" : 25
`,
    firstToken: 'Ejemplo de proporción'
  }
}
