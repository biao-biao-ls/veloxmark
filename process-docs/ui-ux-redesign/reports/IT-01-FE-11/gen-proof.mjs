// One-shot generator: proof harness for IT-01 FE-11 (frozen copy + overlay tokens).
// Reads the real i18n dictionaries and links the real tokens.css/themes.css so the
// proof screenshot cannot drift from the shipped sources.
import { readFileSync, writeFileSync } from 'node:fs'

const ROOT = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer/src'
const OUT = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-11/IT-01-FE-11-proof.html'

function dictValues(file) {
  const src = readFileSync(`${ROOT}/i18n/${file}`, 'utf8')
  const out = {}
  for (const m of src.matchAll(/^\s*'([^']+)':\s*(?:'([^']*)'|"([^"]*)")/gm)) {
    out[m[1]] = m[2] ?? m[3]
  }
  return out
}

const zh = dictValues('zh.ts')
const en = dictValues('en.ts')

const RECEIPTS = [
  ['toast.rowInsertedAbove', {}],
  ['toast.rowInsertedBelow', {}],
  ['toast.rowDeleted', { i: 3 }],
  ['toast.colInsertedLeft', {}],
  ['toast.colInsertedRight', {}],
  ['toast.colDeleted', { j: 2 }],
  ['toast.rowMovedUp', {}],
  ['toast.rowMovedDown', {}],
  ['toast.colMovedLeft', {}],
  ['toast.colMovedRight', {}],
  ['toast.colAlignLeft', { j: 2 }],
  ['toast.colAlignCenter', { j: 2 }],
  ['toast.colAlignRight', { j: 2 }],
  ['toast.tableResized', { R: 3, C: 4 }],
  ['toast.tableDeleted', {}],
  ['toast.undone', {}],
  ['toast.copiedTable', {}],
  ['toast.tableFormatted', {}],
  ['toast.tableUnchanged', {}]
]

function fill(v, params) {
  let s = v
  for (const [k, val] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(val))
  return s
}

function rows() {
  return RECEIPTS.map(([key, p]) =>
    `<tr><td class="k">${key}</td><td class="v">${fill(zh[key] ?? '?', p)}</td><td class="v">${fill(en[key] ?? '?', p)}</td></tr>`
  ).join('\n')
}

function panel(theme) {
  return `
<section class="app ${theme}">
  <h2>${theme} — frozen copy (zh / en) + overlay tokens</h2>
  <table>
    <tr><th>key</th><th>zh（冻结）</th><th>en</th></tr>
    ${rows()}
    <tr><td class="k">ctx.deleteTableConfirm</td><td class="v">${zh['ctx.deleteTableConfirm']}</td><td class="v">${en['ctx.deleteTableConfirm']}</td></tr>
    <tr><td class="k">ctx.deleteTableConfirmOk</td><td class="v">${zh['ctx.deleteTableConfirmOk']}</td><td class="v">${en['ctx.deleteTableConfirmOk']}</td></tr>
    <tr><td class="k">dialog.cancel</td><td class="v">${zh['dialog.cancel']}</td><td class="v">${en['dialog.cancel']}</td></tr>
    <tr><td class="k">err.readonly</td><td class="v">${zh['err.readonly']}</td><td class="v">${en['err.readonly']}</td></tr>
    <tr><td class="k">err.autosaveFailed</td><td class="v">${zh['err.autosaveFailed']}</td><td class="v">${en['err.autosaveFailed']}</td></tr>
    <tr><td class="k">toast.undoBtn</td><td class="v">${zh['toast.undoBtn']}</td><td class="v">${en['toast.undoBtn']}</td></tr>
  </table>

  <h3>token swatches (live from tokens.css + themes.css)</h3>
  <div class="swatches">
    <div class="swatch toast-sim">
      <span class="toast-msg">${fill(zh['toast.rowDeleted'], { i: 3 })}</span>
      <button class="undo-btn" type="button">${zh['toast.undoBtn']}</button>
    </div>
    <div class="swatch menu-sim">
      <div class="menu-item">上移该行</div>
      <div class="menu-item is-disabled">上移该行（禁用灰显）</div>
      <div class="menu-item is-danger">${zh['ctx.deleteTable']}</div>
    </div>
    <div class="swatch grid-sim">
      <div class="grid-cells">
        <div class="gcell sel"></div><div class="gcell sel"></div><div class="gcell sel"></div>
        <div class="gcell sel"></div><div class="gcell"></div><div class="gcell"></div>
      </div>
      <div class="grid-label">3 × 2 · 缩放整表</div>
    </div>
    <div class="swatch confirm-sim">
      <p class="confirm-text">${zh['ctx.deleteTableConfirm']}</p>
      <div class="confirm-actions">
        <button class="btn btn-secondary" type="button">${zh['dialog.cancel']}</button>
        <button class="btn btn-danger" type="button">${zh['ctx.deleteTableConfirmOk']}</button>
      </div>
    </div>
    <ul class="tokens">
      <li>--toast-bg = <code class="tv" data-tok="--toast-bg"></code></li>
      <li>--toast-fg = <code class="tv" data-tok="--toast-fg"></code></li>
      <li>--toast-border = <code class="tv" data-tok="--toast-border"></code></li>
      <li>--accent-soft-strong = <code class="tv" data-tok="--accent-soft-strong"></code></li>
      <li>--shadow-menu = <code class="tv" data-tok="--shadow-menu"></code></li>
      <li>--danger-soft = <code class="tv" data-tok="--danger-soft"></code></li>
      <li>--grid-cell-size = <code class="tv" data-tok="--grid-cell-size"></code></li>
      <li>--grid-cell-gap = <code class="tv" data-tok="--grid-cell-gap"></code></li>
    </ul>
  </div>
</section>`
}

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>IT-01 FE-11 — frozen copy + overlay token base</title>
<link rel="stylesheet" href="file:///D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer/src/styles/tokens.css">
<link rel="stylesheet" href="file:///D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer/src/styles/themes.css">
<style>
  body { margin: 0; padding: 16px; background: #888; font-family: system-ui, sans-serif; display: flex; gap: 16px; align-items: flex-start; }
  section.app { flex: 1; min-width: 520px; padding: 16px; border-radius: 8px; }
  h2 { font-size: 15px; margin: 0 0 8px; }
  h3 { font-size: 13px; margin: 12px 0 6px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid var(--border); padding: 4px 8px; text-align: left; }
  th { background: var(--bg-inset); color: var(--fg-dim); }
  .k { font-family: monospace; color: var(--fg-dim); }
  .v { color: var(--fg); }
  .swatches { display: flex; flex-wrap: wrap; gap: 12px; }
  .swatch { border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-3); background: var(--bg); }
  .toast-sim { display: flex; align-items: center; gap: var(--space-3); background: var(--toast-bg); color: var(--toast-fg); border: 1px solid var(--toast-border); border-radius: var(--radius-sm); box-shadow: var(--shadow-pop); font-size: 13px; }
  .undo-btn { color: var(--accent); border: 1px solid var(--accent); border-radius: var(--radius-sm); background: transparent; padding: 2px var(--space-2); font-size: 13px; font-weight: 600; }
  .menu-sim { width: 200px; background: var(--bg); box-shadow: var(--shadow-menu); padding: var(--space-1) 0; }
  .menu-item { height: 30px; display: flex; align-items: center; padding: 0 var(--space-3); font-size: 13px; color: var(--fg); }
  .menu-item.is-disabled { color: var(--fg-disabled); }
  .menu-item.is-danger { color: var(--danger); font-weight: 500; background: var(--danger-soft); }
  .grid-cells { display: grid; grid-template-columns: repeat(3, var(--grid-cell-size)); gap: var(--grid-cell-gap); }
  .gcell { width: var(--grid-cell-size); height: var(--grid-cell-size); background: var(--bg); border: 1px solid var(--bg-inset); border-radius: var(--radius-sm); }
  .gcell.sel { background: var(--accent-soft-strong); border-color: var(--accent); }
  .grid-label { margin-top: var(--space-2); text-align: center; font-size: 12px; color: var(--fg-dim); }
  .confirm-sim { width: 300px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: var(--shadow-modal); padding: var(--space-5); }
  .confirm-text { font-size: 13px; line-height: 1.6; color: var(--fg-dim); margin: 0 0 var(--space-5); }
  .confirm-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
  .btn { display: inline-flex; align-items: center; height: 30px; padding: 0 var(--space-4); border-radius: var(--radius-sm); font-size: 13px; border: 1px solid var(--border); background: var(--bg); color: var(--fg); }
  .btn-danger { background: var(--danger); border-color: var(--danger); color: var(--on-accent); font-weight: 600; }
  .tokens { list-style: none; margin: 8px 0 0; padding: 0; font-size: 11px; color: var(--fg-dim); font-family: monospace; }
  .tokens code { color: var(--fg); }
</style>
</head>
<body>
${panel('theme-light')}
${panel('theme-dark')}
<script>
  for (const el of document.querySelectorAll('.tv')) {
    el.textContent = getComputedStyle(el.closest('.app')).getPropertyValue(el.dataset.tok).trim()
  }
</script>
</body>
</html>`

writeFileSync(OUT, html)
console.log('written', OUT)
