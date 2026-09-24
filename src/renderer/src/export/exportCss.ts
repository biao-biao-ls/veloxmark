/**
 * Standalone document stylesheet for exported HTML/PDF (P04).
 *
 * Mirrors the visual values of the editor's `cm-md-*` styles in styles.css,
 * but targets semantic tags (h1/p/table/…) inside `.export-doc` so the output
 * has no CodeMirror dependency. Theme variables come from export/palette.ts
 * (P20) — shared with the rich-text clipboard inline styles.
 */

import {
  DARK_PALETTE,
  LIGHT_CALLOUTS,
  LIGHT_PALETTE,
  DARK_CALLOUTS,
  paletteToCssVars,
  type CalloutColors
} from './palette'

const lightVars = `\n${paletteToCssVars(LIGHT_PALETTE)}\n`
const darkVars = `\n${paletteToCssVars(DARK_PALETTE)}\n`

/** `--co-bar`/`--co-bg` custom-property rules for one theme (palette-sourced). */
function calloutCss(selectorPrefix: string, co: CalloutColors): string {
  return (Object.keys(co) as (keyof CalloutColors)[])
    .map((t) => `${selectorPrefix} .export-callout-${t} { --co-bar: ${co[t][0]}; --co-bg: ${co[t][1]}; }`)
    .join('\n')
}

export const EXPORT_DOC_CSS = `
.export-theme-light {${lightVars}}
.export-theme-dark {${darkVars}}

.export-doc {
  background: var(--bg);
  color: var(--fg);
  font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  max-width: 860px;
  margin: 0 auto;
  padding: 32px 48px 64px;
  box-sizing: border-box;
}

.export-doc h1,
.export-doc h2,
.export-doc h3,
.export-doc h4,
.export-doc h5,
.export-doc h6 {
  font-weight: 600;
  line-height: 1.4;
  margin-top: 1.2em;
  margin-bottom: 0.5em;
}

.export-doc h1 {
  font-size: 2em;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.2em;
}

.export-doc h2 {
  font-size: 1.5em;
  /* 5C/D1 parallel: h2 rule matches h1. */
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.2em;
}
.export-doc h3 { font-size: 1.25em; }
.export-doc h4 { font-size: 1.1em; }
.export-doc h5 { font-size: 1em; }
.export-doc h6 { font-size: 0.9em; color: var(--fg-dim); }

.export-doc p { margin: 0.5em 0; }

.export-doc a {
  color: var(--accent);
  text-decoration: underline;
}

.export-doc code {
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 0.9em;
  background: var(--code-bg);
  border-radius: 3px;
  padding: 0.1em 0.3em;
}

.export-doc pre {
  margin: 0.5em 0;
  padding: 12px 16px;
  overflow-x: auto;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-alt);
}

.export-doc pre code {
  font-size: 13.5px;
  line-height: 1.55;
  background: transparent;
  padding: 0;
  display: block;
  white-space: pre;
}

.export-doc .export-code {
  margin: 0.5em 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-alt);
}

.export-doc .export-code pre {
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}

.export-doc blockquote {
  border-left: 4px solid var(--quote-border);
  color: var(--fg-dim);
  font-style: italic;
  margin: 0.5em 0;
  padding-left: 1em;
}

.export-doc hr {
  border: none;
  border-bottom: 1px solid var(--hr-color);
  height: 0.5em;
  margin: 1em 0;
}

.export-doc ul,
.export-doc ol {
  margin: 0.3em 0;
  padding-left: 2em;
}

.export-doc li { margin: 0.15em 0; }

.export-doc input[type='checkbox'] {
  margin-right: 6px;
  vertical-align: middle;
  accent-color: var(--accent);
}

.export-doc img {
  max-width: 100%;
  border-radius: 4px;
}

.export-doc table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.95em;
  line-height: 1.6;
  margin: 0.5em 0;
}

.export-doc th,
.export-doc td {
  border: 1px solid var(--border);
  padding: 6px 13px;
  text-align: left;
}

.export-doc th {
  background: var(--bg-alt);
  font-weight: 600;
}

.export-doc tbody tr:nth-child(2n) {
  background: var(--bg-alt);
}

.export-doc .export-mermaid {
  margin: 0.5em 0;
  padding: 16px;
  text-align: center;
  overflow-x: auto;
}

.export-doc .export-mermaid svg {
  max-width: 100%;
  height: auto;
}

.export-doc .export-mermaid-error {
  color: #d1242f;
  font-size: 13px;
  text-align: left;
}

.export-doc .export-math-block {
  margin: 0.5em 0;
  padding: 8px 0;
  overflow-x: auto;
  text-align: center;
}

/* 5C/D2 parallel: buildDocument embeds katex.css whose .katex-display brings
   1em margins — zero them so export spacing matches the editor. */
.export-doc .export-math-block .katex-display {
  margin: 0;
}

.export-theme-dark .katex {
  color: #d4d4d4;
}

/* ---- P11 extended syntax ---------------------------------------------------- */

.export-doc .export-fm-title {
  margin-top: 0;
}

.export-doc mark.export-mark,
.export-doc .export-mark {
  background: var(--highlight-bg);
  border-radius: 2px;
  padding: 0 1px;
  color: inherit;
}

.export-doc sup.export-sup,
.export-doc .export-sup {
  font-size: 0.75em;
  vertical-align: super;
}

.export-doc sub.export-sub,
.export-doc .export-sub {
  font-size: 0.75em;
  vertical-align: sub;
}

.export-doc .export-footnote-ref {
  font-size: 0.75em;
}

.export-doc .export-footnote-ref a {
  color: var(--accent);
  text-decoration: none;
}

.export-doc .export-footnotes-sep {
  margin-top: 2em;
}

.export-doc ol.export-footnotes {
  font-size: 0.9em;
  color: var(--fg-dim);
}

.export-doc ol.export-footnotes li {
  margin: 0.25em 0;
}

.export-doc .export-footnote-backref {
  color: var(--accent);
  text-decoration: none;
  margin-left: 4px;
}

.export-doc abbr {
  text-decoration: underline dotted var(--fg-dim);
  cursor: help;
}

.export-doc dl.export-dl {
  margin: 0.5em 0;
}

.export-doc dl.export-dl dt {
  font-weight: 600;
  margin-top: 0.4em;
}

.export-doc dl.export-dl dd {
  margin: 0.15em 0 0.15em 1.5em;
  color: var(--fg-dim);
}

/* ---- P21 callouts ------------------------------------------------------------ */

.export-doc .export-callout {
  margin: 0.75em 0;
  padding: 10px 14px;
  border-left: 4px solid var(--co-bar, var(--quote-border));
  background: var(--co-bg, var(--bg-alt));
  border-radius: 0 6px 6px 0;
  color: var(--fg);
  font-style: normal;
}

.export-doc .export-callout-head {
  font-weight: 600;
  margin: 0 0 0.35em;
}

.export-doc .export-callout-body {
  margin: 0;
}

.export-doc .export-callout-body > :first-child { margin-top: 0; }
.export-doc .export-callout-body > :last-child { margin-bottom: 0; }

${calloutCss('.export-doc', LIGHT_CALLOUTS)}

${calloutCss('.export-theme-dark', DARK_CALLOUTS)}
`
