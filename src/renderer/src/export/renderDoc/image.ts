import type { RenderDocOptions } from './ctx'



export async function resolveImageForExport(src: string, opts: RenderDocOptions): Promise<string> {
  if (opts.imageMode === 'relative') return src
  if (/^(data:)/i.test(src)) return src
  if (/^https?:/i.test(src)) return src
  try {
    return await window.api.readImageAsDataUrl(opts.baseDir, src)
  } catch {
    return src
  }
}
