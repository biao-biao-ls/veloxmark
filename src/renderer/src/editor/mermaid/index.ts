// editor/mermaid/ — mermaid pipeline (2.3, split out of editor/widgets.ts):
// render core + concurrency gate + cache (render.ts), P16 export IO seam +
// SVG/PNG export (exportIo.ts), error-state memory (errMemory.ts), the block
// widget itself (widget.ts), and the 10A shared render host + focused-edit
// preview widget (renderHost.ts / previewWidget.ts).
export { clearMermaidCache, renderMermaid } from './render'
export { copyPngImage, exportPng, exportSvg, setMermaidExportIo } from './exportIo'
export { getMermaidLastGood, rememberMermaidGood, type MermaidGoodRender } from './errMemory'
export { MermaidWidget } from './widget'
export { MermaidPreviewWidget } from './previewWidget'
