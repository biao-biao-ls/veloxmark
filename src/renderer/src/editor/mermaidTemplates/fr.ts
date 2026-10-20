import type { MermaidBodies } from './types'

export const BODIES_FR: MermaidBodies = {
  flowchart: {
    body: `flowchart TD
    %% Remarque : [] étape / {} décision / --> liaison ; adaptez ce flux à vos besoins
    A[Début] --> B{Condition remplie ?}
    B -->|Oui| C[Traiter la tâche]
    B -->|Non| D[Fin]
`,
    firstToken: 'Début'
  },
  sequence: {
    body: `sequenceDiagram
    %% Remarque : participant définit un rôle, ->> appel continu, -->> retour pointillé
    participant C as Client
    participant S as Serveur
    C->>S: Requête
    S-->>C: Réponse
`,
    firstToken: 'Client'
  },
  class: {
    body: `classDiagram
    %% Remarque : nom de classe { attributs / méthodes }, <|-- signifie l’héritage
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
    %% Remarque : [*] est le début/la fin, --> transition, le texte après : est le déclencheur
    [*] --> EnAttente
    EnAttente --> EnCours : Début
    EnCours --> [*] : Fin
`,
    firstToken: 'EnAttente'
  },
  er: {
    body: `erDiagram
    %% Remarque : ||--o{ est une relation un-à-plusieurs ; entité { champ } définit les attributs
    USER ||--o{ ORDER : passe
    USER {
        string name
        string email
    }
`,
    firstToken: 'USER'
  },
  gantt: {
    body: `gantt
    %% Remarque : tâche : date de début, durée ; le format de date provient de la ligne dateFormat
    title Plan de projet
    dateFormat  YYYY-MM-DD
    section Phase 1
    Recueil des besoins :a1, 2024-01-01, 7d
    Développement :after a1, 14d
`,
    firstToken: 'Plan de projet'
  },
  pie: {
    body: `pie title Exemple de répartition
    %% Remarque : "libellé" : valeur ; les valeurs sont converties en pourcentages automatiquement
    "Partie A" : 40
    "Partie B" : 35
    "Autre" : 25
`,
    firstToken: 'Exemple de répartition'
  }
}
