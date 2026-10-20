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

export interface TemplateBody {
  body: string
  firstToken: string
}

export type MermaidBodies = Record<MermaidTemplateId, TemplateBody>
