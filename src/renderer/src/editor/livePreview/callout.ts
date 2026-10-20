import { t } from '../../i18n'

export type CalloutType =
  | 'note'
  | 'tip'
  | 'important'
  | 'warning'
  | 'caution'
  | 'info'
  | 'success'
  | 'danger'

export const CALLOUT_TYPES: CalloutType[] = [
  'note',
  'tip',
  'important',
  'warning',
  'caution',
  'info',
  'success',
  'danger'
]

export interface CalloutMarker {
  type: CalloutType
  title: string
  fold: 'none' | 'closed' | 'open'
  unknown: boolean
  rawType: string
  markerText: string
  markerStart: number
  markerEnd: number
}

const CALLOUT_RE = /^(\s*>\s*)\[!\s*([A-Za-z][\w-]*)\s*\]([+-])?[ \t]*(.*)$/

export function parseCalloutMarker(firstLine: string): CalloutMarker | null {
  const m = CALLOUT_RE.exec(firstLine)
  if (!m) return null
  const prefix = m[1]
  const rawType = m[2].toUpperCase()
  const foldChar = m[3]
  const rest = (m[4] ?? '').trim()
  const lower = rawType.toLowerCase()
  const known = (CALLOUT_TYPES as string[]).includes(lower)
  const type: CalloutType = known ? (lower as CalloutType) : 'note'
  const title = rest
  const markerStart = prefix.length
  const bracketEnd = firstLine.indexOf(']', markerStart) + 1
  const fold = foldChar === '-' ? 'closed' : foldChar === '+' ? 'open' : 'none'
  let markerEnd = bracketEnd + (foldChar ? 1 : 0)
  const nextCh = firstLine[markerEnd]
  if (nextCh === ' ' || nextCh === '\t') markerEnd += 1
  const markerText = firstLine.slice(markerStart, bracketEnd) + (foldChar ?? '')
  return { type, title, fold, unknown: !known, rawType, markerText, markerStart, markerEnd }
}

export const CALLOUT_ICON: Record<CalloutType, string> = {
  note: 'ℹ',
  tip: '💡',
  important: '❗',
  warning: '⚠',
  caution: '⚡',
  info: '📌',
  success: '✅',
  danger: '⛔'
}

export function calloutDefaultTitle(type: CalloutType): string {
  return t('callout.' + type)
}

export function calloutDisplayTitle(marker: CalloutMarker): string {
  return marker.title || (marker.unknown ? marker.rawType : calloutDefaultTitle(marker.type))
}
