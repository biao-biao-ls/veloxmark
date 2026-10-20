import type { CalloutMarker } from '../../editor/livePreview/callout'


export function dropCalloutHeadHtml(parts: string[], marker: CalloutMarker): string[] {
  const out = parts.slice()
  if (out.length === 0) return out
  const m = /^(<p[^>]*>)([\s\S]*)(<\/p>)$/.exec(out[0])
  if (!m) return out
  const text = m[2]
  const idx = text.indexOf(marker.markerText)
  if (idx === -1) return out
  const after = text.slice(idx + marker.markerText.length)
  const nl = /(?:<br\s*\/?>|\n)([\s\S]*)$/.exec(after)
  const bodyRest = nl ? nl[1].replace(/^\s+/, '') : ''
  if (!bodyRest) {
    out.shift()
  } else {
    out[0] = m[1] + bodyRest + m[3]
  }
  return out
}
