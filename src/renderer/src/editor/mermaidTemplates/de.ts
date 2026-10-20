import type { MermaidBodies } from './types'

export const BODIES_DE: MermaidBodies = {
  flowchart: {
    body: `flowchart TD
    %% Hinweis: [] Schritt / {} Entscheidung / --> Verbindung; an deinen Ablauf anpassen
    A[Start] --> B{Bedingung erfüllt?}
    B -->|Ja| C[Aufgabe ausführen]
    B -->|Nein| D[Ende]
`,
    firstToken: 'Start'
  },
  sequence: {
    body: `sequenceDiagram
    %% Hinweis: participant definiert eine Rolle, ->> durchgezogener Aufruf, -->> gestrichelte Rückgabe
    participant C as Client
    participant S as Server
    C->>S: Anfrage
    S-->>C: Antwort
`,
    firstToken: 'Client'
  },
  class: {
    body: `classDiagram
    %% Hinweis: Klassenname { Attribute / Methoden }, <|-- bedeutet Vererbung
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
    %% Hinweis: [*] ist Start/Ende, --> Übergang, Text nach : ist der Auslöser
    [*] --> Ausstehend
    Ausstehend --> InBearbeitung : Start
    InBearbeitung --> [*] : Fertig
`,
    firstToken: 'Ausstehend'
  },
  er: {
    body: `erDiagram
    %% Hinweis: ||--o{ ist eins-zu-viele; Entity { Feld } definiert Attribute
    USER ||--o{ ORDER : bestellt
    USER {
        string name
        string email
    }
`,
    firstToken: 'USER'
  },
  gantt: {
    body: `gantt
    %% Hinweis: Aufgabe : Startdatum, Dauer; das Datumsformat kommt aus der dateFormat-Zeile
    title Projektplan
    dateFormat  YYYY-MM-DD
    section Phase 1
    Anforderungen :a1, 2024-01-01, 7d
    Entwicklung :after a1, 14d
`,
    firstToken: 'Projektplan'
  },
  pie: {
    body: `pie title Anteilsbeispiel
    %% Hinweis: "Label" : Wert; Werte werden automatisch in Prozente umgerechnet
    "Teil A" : 40
    "Teil B" : 35
    "Sonstiges" : 25
`,
    firstToken: 'Anteilsbeispiel'
  }
}
