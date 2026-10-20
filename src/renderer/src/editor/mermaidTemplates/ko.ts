import type { MermaidBodies } from './types'

export const BODIES_KO: MermaidBodies = {
  flowchart: {
    body: `flowchart TD
    %% 참고: [] 단계 / {} 판단 / --> 연결; 자신의 흐름에 맞게 수정하세요
    A[시작] --> B{조건 충족?}
    B -->|예| C[작업 처리]
    B -->|아니요| D[종료]
`,
    firstToken: '시작'
  },
  sequence: {
    body: `sequenceDiagram
    %% 참고: participant는 역할을 정의하고, ->>는 실선 호출, -->>는 점선 반환입니다
    participant C as 클라이언트
    participant S as 서버
    C->>S: 요청
    S-->>C: 응답
`,
    firstToken: '클라이언트'
  },
  class: {
    body: `classDiagram
    %% 참고: class 이름 { 속성 / 메서드 }, <|-- 는 상속을 의미합니다
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
    %% 참고: [*]는 시작/종료, -->는 전이, 콜론 뒤는 트리거입니다
    [*] --> 대기
    대기 --> 진행중 : 시작
    진행중 --> [*] : 완료
`,
    firstToken: '대기'
  },
  er: {
    body: `erDiagram
    %% 참고: ||--o{ 는 일대다 관계이며, 엔터티 { 필드 }로 속성을 정의합니다
    USER ||--o{ ORDER : 주문
    USER {
        string name
        string email
    }
`,
    firstToken: 'USER'
  },
  gantt: {
    body: `gantt
    %% 참고: 작업 : 시작일, 기간; 날짜 형식은 dateFormat 행을 따릅니다
    title 프로젝트 계획
    dateFormat  YYYY-MM-DD
    section 1단계
    요구사항 :a1, 2024-01-01, 7d
    개발 :after a1, 14d
`,
    firstToken: '프로젝트 계획'
  },
  pie: {
    body: `pie title 비율 예시
    %% 참고: "레이블" : 값; 값은 자동으로 백분율로 변환됩니다
    "부분 A" : 40
    "부분 B" : 35
    "기타" : 25
`,
    firstToken: '비율 예시'
  }
}
