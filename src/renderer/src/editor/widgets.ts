/**
 * Widget module barrel (task 2A, steps 2.1–2.7) — the widget implementations
 * live in sibling modules; this barrel keeps historical `from './widgets'`
 * imports working (zero-change fallback). New code imports the owning module
 * directly (e.g. `./image-widget`, `./mermaid`).
 */
export { BlockWidget, type BlockToolbarItem } from './blockWidget'
export { highlightCodeHtml, renderKatexHtml, splitHighlightedLines } from './render-helpers'
export { flipTransform, parseImageMarkdown, type ParsedImage } from './image-parse'
export {
  clearMermaidCache,
  copyPngImage,
  exportPng,
  exportSvg,
  MermaidWidget,
  renderMermaid,
  setMermaidExportIo
} from './mermaid'
export {
  CodeBlockWidget,
  CodeLangChip,
  ensureScopedCss,
  type CodeBlockUiOptions
} from './codeBlock-widget'
export { closeAllImageSelections, ImageWidget, invalidateImageCache } from './image-widget'
export { InlineMathWidget, MathBlockWidget } from './widgets-math'
export {
  FootnoteDefBackWidget,
  FootnoteRefWidget,
  FrontMatterWidget,
  TaskWidget
} from './widgets-extended'
