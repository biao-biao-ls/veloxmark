/**
 * P21 callout (提示块) parsing — GitHub/Obsidian `> [!TYPE]` marker syntax.
 *
 * Pure string logic, node-testable (vitest). Rendering decorations live in
 * handlers.ts (`enterCallout`) + calloutFold.ts; export mapping in
 * export/renderDoc.ts. The parser never touches i18n — display names come
 * from `calloutDefaultTitle`, which reads the active P14 language at call time.
 */
import { getLang } from '../../i18n'

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
  /** Normalized type; unknown source types fall back to 'note' styling. */
  type: CalloutType
  /** Custom title text written after the marker (trimmed), '' when none. */
  title: string
  fold: 'none' | 'closed' | 'open'
  /** True when the source TYPE was not one of the 8 known types. */
  unknown: boolean
  /** TYPE text uppercased — fallback title when unknown, fold key component. */
  rawType: string
  /** Exact `[!TYPE]` + fold char as written — used for export HTML stripping. */
  markerText: string
  /** Index of `[` within the first-line string. */
  markerStart: number
  /** Index just past `]` + optional fold char + one optional following space. */
  markerEnd: number
}

/** `>` + optional spaces, `[!TYPE]`, optional +/- fold marker, rest = title. */
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
  // `title` is SOURCE-ONLY (empty when the marker line has none); display
  // fallback for unknown TYPE / default names lives in calloutDisplayTitle.
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

/** Unicode icons — no icon library (CSS `::before` mirrors these in styles.css). */
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

/** Default display names per language (P14 i18n; zh is the docs' first版). */
export const DEFAULT_CALLOUT_TITLES: Record<'zh' | 'en', Record<CalloutType, string>> = {
  zh: {
    note: '注意',
    tip: '提示',
    important: '重要',
    warning: '警告',
    caution: '谨慎',
    info: '信息',
    success: '成功',
    danger: '危险'
  },
  en: {
    note: 'Note',
    tip: 'Tip',
    important: 'Important',
    warning: 'Warning',
    caution: 'Caution',
    info: 'Info',
    success: 'Success',
    danger: 'Danger'
  }
}

export function calloutDefaultTitle(type: CalloutType): string {
  return DEFAULT_CALLOUT_TITLES[getLang()][type]
}

/**
 * Title shown in live preview / export head:
 * custom source title → raw TYPE when unknown → localized default.
 */
export function calloutDisplayTitle(marker: CalloutMarker): string {
  return marker.title || (marker.unknown ? marker.rawType : calloutDefaultTitle(marker.type))
}
