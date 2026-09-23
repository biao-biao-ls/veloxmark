import type { CalloutMarker } from '../../editor/livePreview/callout'

// ---- callout export helpers (3.15) ----
// (3C: moved verbatim from export/renderDoc.ts.)

/**
 * P21: strip the callout head line (marker + title) from the first rendered
 * part of a blockquote body — that content is re-homed into the export head
 * element. The head line and following body lines usually share one <p>
 * (soft line breaks), so only the head-line segment is removed.
 */
export function dropCalloutHeadHtml(parts: string[], marker: CalloutMarker): string[] {
  const out = parts.slice()
  if (out.length === 0) return out
  const m = /^(<p[^>]*>)([\s\S]*)(<\/p>)$/.exec(out[0])
  if (!m) return out
  const text = m[2]
  const idx = text.indexOf(marker.markerText)
  if (idx === -1) return out
  const after = text.slice(idx + marker.markerText.length)
  // Body content starts after the first newline / <br> — everything before it
  // on the head segment is the title, consumed by export-callout-head.
  const nl = /(?:<br\s*\/?>|\n)([\s\S]*)$/.exec(after)
  const bodyRest = nl ? nl[1].replace(/^\s+/, '') : ''
  if (!bodyRest) {
    out.shift()
  } else {
    out[0] = m[1] + bodyRest + m[3]
  }
  return out
}
