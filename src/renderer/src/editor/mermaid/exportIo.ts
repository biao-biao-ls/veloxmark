import { t } from '../../i18n'
import { showSaveDialog as e2eShowSaveDialog } from '../../export/e2eSaveDialog'
import { getCtxRuntime } from '../contextMenu/registry'


interface MermaidExportIo {
  showSaveDialog: (defaultPath?: string, filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
  writeFile: (filePath: string, content: string) => Promise<void>
  writeFileBase64: (filePath: string, base64: string) => Promise<boolean>
  clipboardWriteImage: (dataUrl: string) => Promise<void>
}

let mermaidIoOverride: Partial<MermaidExportIo> | null = null

export function setMermaidExportIo(io: Partial<MermaidExportIo> | null): void {
  mermaidIoOverride = io
}

const mermaidIo: MermaidExportIo = {
  showSaveDialog: (defaultPath, filters) =>
    mermaidIoOverride?.showSaveDialog
      ? mermaidIoOverride.showSaveDialog(defaultPath, filters)
      : e2eShowSaveDialog(defaultPath, filters),
  writeFile: async (filePath, content) => {
    if (mermaidIoOverride?.writeFile) return mermaidIoOverride.writeFile(filePath, content)
    await window.api.writeFile(filePath, content)
  },
  writeFileBase64: (filePath, base64) =>
    mermaidIoOverride?.writeFileBase64
      ? mermaidIoOverride.writeFileBase64(filePath, base64)
      : window.api.writeFileBase64(filePath, base64),
  clipboardWriteImage: (dataUrl) =>
    mermaidIoOverride?.clipboardWriteImage
      ? mermaidIoOverride.clipboardWriteImage(dataUrl)
      : window.api.clipboardWriteImage(dataUrl)
}

export async function exportSvg(svgEl: SVGSVGElement): Promise<void> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  if (!clone.getAttribute('viewBox')) {
    const w = svgEl.clientWidth || Number(clone.getAttribute('width')) || 800
    const h = svgEl.clientHeight || Number(clone.getAttribute('height')) || 600
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`)
  }
  const content = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
  const target = await mermaidIo.showSaveDialog('diagram.svg', [
    { name: 'SVG', extensions: ['svg'] },
    { name: 'All Files', extensions: ['*'] }
  ])
  if (!target) return
  try {
    await mermaidIo.writeFile(target, content)
    getCtxRuntime()?.toast(t('toast.exportSuccess', { path: target }))
  } catch {
    getCtxRuntime()?.toast(t('toast.exportFailed'))
  }
}

async function rasterizeSvgToPng(svgEl: SVGSVGElement, scale = 2): Promise<string | null> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const w = svgEl.clientWidth || Number(clone.getAttribute('width')) || 800
  const h = svgEl.clientHeight || Number(clone.getAttribute('height')) || 600
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${w} ${h}`)
  const svgText = new XMLSerializer().serializeToString(clone)
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`
  const img = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('svg image failed to load'))
      img.src = url
    })
  } catch {
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((img.width || w) * scale))
  canvas.height = Math.max(1, Math.round((img.height || h) * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

export async function exportPng(svgEl: SVGSVGElement): Promise<void> {
  const dataUrl = await rasterizeSvgToPng(svgEl, 2)
  if (!dataUrl) return
  const target = await mermaidIo.showSaveDialog('diagram.png', [
    { name: 'PNG', extensions: ['png'] },
    { name: 'All Files', extensions: ['*'] }
  ])
  if (!target) return
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  try {
    const ok = await mermaidIo.writeFileBase64(target, b64)
    if (ok === false) throw new Error('writeFileBase64 returned false')
    getCtxRuntime()?.toast(t('toast.exportSuccess', { path: target }))
  } catch {
    getCtxRuntime()?.toast(t('toast.exportFailed'))
  }
}

export async function copyPngImage(svgEl: SVGSVGElement): Promise<void> {
  const dataUrl = await rasterizeSvgToPng(svgEl, 2)
  if (!dataUrl) return
  try {
    await mermaidIo.clipboardWriteImage(dataUrl)
    getCtxRuntime()?.toast(t('toast.copiedImage'))
  } catch {
    getCtxRuntime()?.toast(t('toast.exportFailed'))
  }
}
