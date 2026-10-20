import type { MermaidBodies } from './types'

export const BODIES_RU: MermaidBodies = {
  flowchart: {
    body: `flowchart TD
    %% Примечание: [] шаг / {} условие / --> связь; адаптируйте под свой процесс
    A[Начало] --> B{Условие выполнено?}
    B -->|Да| C[Обработать задачу]
    B -->|Нет| D[Конец]
`,
    firstToken: 'Начало'
  },
  sequence: {
    body: `sequenceDiagram
    %% Примечание: participant задает роль, ->> сплошная стрелка вызова, -->> пунктирная стрелка ответа
    participant C as Клиент
    participant S as Сервер
    C->>S: Запрос
    S-->>C: Ответ
`,
    firstToken: 'Клиент'
  },
  class: {
    body: `classDiagram
    %% Примечание: имя класса { атрибуты / методы }, <|-- означает наследование
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
    %% Примечание: [*] — начало/конец, --> переход, текст после : — триггер
    [*] --> Ожидание
    Ожидание --> Выполнение : Старт
    Выполнение --> [*] : Готово
`,
    firstToken: 'Ожидание'
  },
  er: {
    body: `erDiagram
    %% Примечание: ||--o{ — связь «один ко многим»; сущность { поле } задает атрибуты
    USER ||--o{ ORDER : оформляет
    USER {
        string name
        string email
    }
`,
    firstToken: 'USER'
  },
  gantt: {
    body: `gantt
    %% Примечание: задача : дата начала, длительность; формат даты задается строкой dateFormat
    title План проекта
    dateFormat  YYYY-MM-DD
    section Этап 1
    Требования :a1, 2024-01-01, 7d
    Разработка :after a1, 14d
`,
    firstToken: 'План проекта'
  },
  pie: {
    body: `pie title Пример долей
    %% Примечание: "метка" : значение; значения автоматически переводятся в проценты
    "Часть A" : 40
    "Часть B" : 35
    "Прочее" : 25
`,
    firstToken: 'Пример долей'
  }
}
