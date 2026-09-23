import type { RenderDocOptions } from './ctx'

// ---- images (3.15) ----
// (3C: moved verbatim from export/renderDoc.ts.)

// ---- images --------------------------------------------------------------------

/**
 * Resolve an image src for export: embed mode inlines local files as data
 * URLs via main (no CORS issues with mdres://); relative mode keeps the
 * markdown src verbatim so it can live next to the exported HTML.
 */
export async function resolveImageForExport(src: string, opts: RenderDocOptions): Promise<string> {
  if (opts.imageMode === 'relative') return src
  if (/^(data:)/i.test(src)) return src
  if (/^https?:/i.test(src)) return src // remote: keep URL (offline = broken, same as editor)
  try {
    return await window.api.readImageAsDataUrl(opts.baseDir, src)
  } catch {
    return src
  }
}
