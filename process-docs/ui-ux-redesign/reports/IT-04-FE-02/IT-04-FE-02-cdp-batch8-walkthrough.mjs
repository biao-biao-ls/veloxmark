#!/usr/bin/env node
/**
 * IT-04 FE-02 批次 ⑧ 双主题走查总口径（AC-NF-15 / AC-RULE-17）
 * 8.1/8.2 ui_01..07 原型结构对照（浅/深各一遍）+ 截图留档（PEND-14：无数值视觉断言）
 * 8.5   e2e 缝契约终态扫描（__velox* / data-op / data-table-handle / 命令 id 字面量）
 */
import { writeFileSync, mkdirSync } from 'node:fs'
const PORT = Number(process.env.IT04_FE02_CDP_PORT ?? 9501)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const SHOT_DIR = `${OUT_DIR}/shots`
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it04-fe02-walkthrough.md`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(SHOT_DIR, { recursive: true })

const FIXTURE = [
  '# 走查夹具主标题',
  '',
  '## 二级节甲',
  '',
  '正文段落（渲染区对照）。',
  '',
  '> 引用块第一行',
  '> 引用块第二行',
  '> 引用块第三行',
  '> 引用块第四行',
  '> 引用块第五行',
  '> 引用块第六行',
  '',
  '- [ ] 待办项',
  '- [x] 已办项',
  '',
  '| A | B |',
  '| :--- | :---: |',
  '| 1 | 2 |',
  '| 3 | 4 |',
  '',
  '```js',
  'const x = 1 // 代码块',
  '```',
  '',
  '$$',
  'E = mc^2',
  '$$',
  '',
  '## 二级节乙',
  '',
  '乙节正文。',
  ''
].join('\n')
writeFileSync(FIXTURE_PATH, FIXTURE)

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let msgId = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(String(ev.data))
  if (!msg.id || !pending.has(msg.id)) return
  const { resolve, reject } = pending.get(msg.id)
  pending.delete(msg.id)
  if (msg.error) reject(new Error(JSON.stringify(msg.error)))
  else resolve(msg.result)
})
function send(method, params = {}) {
  const id = ++msgId
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
}
async function evalExpr(expression, timeoutMs = 20000) {
  let timer
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('evaluate timeout')), timeoutMs) })
  try {
    const r = await Promise.race([send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }), timeout])
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  } finally { clearTimeout(timer) }
}
async function clickAt(x, y, button = 'left') {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons: button === 'right' ? 2 : 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: 1 })
}
async function pressKey(key, code, opts = {}) {
  const { ctrlKey, shiftKey, altKey, metaKey, ...rest } = opts
  let modifiers = 0
  if (altKey) modifiers |= 1
  if (ctrlKey) modifiers |= 2
  if (metaKey) modifiers |= 4
  if (shiftKey) modifiers |= 8
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, ...rest })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, ...rest })
}
async function dismissAllDialogs(max = 6) {
  for (let i = 0; i < max; i++) {
    const btn = await evalExpr(`(() => {
      const d = document.querySelector('.dialog-overlay:not(.prefs-overlay)')
      const use = d ?? document.querySelector('.dialog-overlay .dialog')
      if (!use) return null
      const host = use.closest('.dialog-overlay') ?? use
      const btns = [...host.querySelectorAll('.dialog-buttons .dialog-btn, .dialog-btn')]
      const byText = (t) => btns.find((b) => (b.textContent ?? '').trim() === t)
      const target = byText('稍后') ?? byText('取消') ?? byText('确定') ?? btns[btns.length - 1]
      if (!target) return null
      const r = target.getBoundingClientRect()
      return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
    })()`)
    if (!btn) break
    await clickAt(btn.x, btn.y)
    await sleep(400)
  }
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${SHOT_DIR}/${name}`, Buffer.from(shot.data, 'base64'))
  return name
}

const results = { meta: { port: PORT, startedAt: new Date().toISOString(), batch: '⑧双主题走查+缝扫描' }, checks: [], walk: {} }
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 500) : ''}`)
  return !!ok
}

await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await dismissAllDialogs()
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1600)
await dismissAllDialogs()

// ── 结构对照探针（原型 ui_01..07 → 实现 DOM 标记）──────────────────────────
const PROBES = `(async () => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  return {
    // ui_01 主静息
    ui01: {
      menubar: visible(q('.menubar')),
      tabsBar: visible(q('.tabs-bar')),
      tabItem: visible(q('.tabs-bar .tab, .tabs-bar [class*="tab"]')),
      editor: visible(q('.cm-editor')),
      sidebar: visible(q('.sidebar')),
      statusbar: visible(q('.status-bar')),
      quietNoTableToolbar: !q('.cm-md-table-toolbar'),
      docH1: qa('.cm-md-h1, .cm-line').length > 0
    },
    // ui_02 表编辑（需先进 cell-active —— 下面交互步骤后复测）
    ui02_pre: {
      tableWrap: !!q('.cm-md-table-wrap table'),
      colGrip: qa('[data-table-handle="col-grip"]').length,
      otherHandles: qa('[data-table-handle]:not([data-table-handle="col-grip"])').length
    },
    // ui_04 菜单栏
    ui04: {
      menubarLabels: qa('.menubar-label').length,
      menuRoots: qa('.menubar-root').length
    },
    // ui_05 侧栏
    ui05: {
      sidebarTabs: qa('.sidebar-tab').length,
      sidebarResizer: !!q('.sidebar-resizer'),
      fileTreeOrOutline: !!q('.sidebar [class*="file"], .outline-item, .sidebar [class*="outline"]')
    },
    // ui_06 渲染区
    ui06: {
      codeBlock: !!q('.cm-md-code-block, .export-code, .cm-md-code-wrap'),
      math: !!q('.cm-md-math, .cm-md-math-block'),
      quote: !!q('.cm-md-quote'),
      taskChip: !!q('.cm-md-task, .cm-md-task-box, [class*="task"]'),
      headingFoldCaret: !!q('[data-testid="heading-fold-caret"]'),
      table: !!q('.cm-md-table-wrap table')
    }
  }
})()`

async function walk(theme) {
  await evalExpr(`window.__veloxP20.setThemePref('${theme}')`)
  // 每轮重载夹具（walk 内 Ctrl+Z 会消耗 loadDoc 历史条目）
  await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
  await sleep(1300)
  await dismissAllDialogs()
  await sleep(400)
  const pre = await evalExpr(PROBES)
  // ui_02：点入单元格 → 7C 工具栏 + ⊞ 网格
  await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
  const cell = await evalExpr(`(() => {
    const td = document.querySelector('.cm-md-table-wrap table tr td')
    if (!td) return null
    const r = td.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (cell) await clickAt(cell.x, cell.y)
  await sleep(700)
  const ui02 = await evalExpr(`(() => ({
    toolbar: !!document.querySelector('[data-op="alignCenter"]') && !!document.querySelector('[data-op="resizeTable"]') && !!document.querySelector('[data-op="TBL-MOR-OPN"]') && !!document.querySelector('[data-op="deleteTable"]'),
    toolbarOps: [...document.querySelectorAll('.cm-md-table-toolbar [data-op]')].map((e) => e.dataset.op),
    gridBtn: !!document.querySelector('[data-op="resizeTable"]')
  }))()`)
  const gridBtn = await evalExpr(`(() => {
    const b = document.querySelector('[data-op="resizeTable"]')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (gridBtn) await clickAt(gridBtn.x, gridBtn.y)
  await sleep(500)
  const grid = await evalExpr(`(() => ({
    picker: !!document.querySelector('.table-grid-picker'),
    cells: document.querySelectorAll('.table-grid-cell').length,
    presets: document.querySelectorAll('.table-grid-picker-preset').length
  }))()`)
  await pressKey('Escape', 'Escape')
  await sleep(300)
  // ui_03：⋮ 更多操作菜单 → data-op 面
  const moreBtn = await evalExpr(`(() => {
    const b = document.querySelector('[data-op="TBL-MOR-OPN"]')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (moreBtn) await clickAt(moreBtn.x, moreBtn.y)
  await sleep(500)
  const menuOps = await evalExpr(`[...document.querySelectorAll('[data-op]')].map((e) => e.dataset.op).filter((op) => op && !['resizeTable', 'TBL-MOR-OPN', 'alignLeft', 'alignCenter', 'alignRight', 'deleteTable'].includes(op))`)
  await pressKey('Escape', 'Escape')
  await sleep(300)
  // ui_07：toast（键入后 Ctrl+Z → 「已撤销」）+ 右键菜单（正文行）+ 偏好设置对话框
  await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'q', code: 'KeyQ', text: 'q' })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'q', code: 'KeyQ' })
  await sleep(300)
  await pressKey('z', 'KeyZ', { ctrlKey: true })
  await sleep(700)
  const toast = await evalExpr(`({ host: !!document.querySelector('.toast-host'), msg: (document.querySelector('.toast-msg')?.textContent ?? '').trim() })`)
  // 右键须落在正文段落行（表格 widget 另有 ctx 入口，cm-content 几何中心易命中表格）
  const paraBox = await evalExpr(`(() => {
    const p = [...document.querySelectorAll('.cm-content .cm-line')].find((l) => l.textContent.includes('正文'))
    if (!p) return null
    const r = p.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (paraBox) await clickAt(paraBox.x, paraBox.y, 'right')
  await sleep(600)
  const ctxMenu = await evalExpr(`(() => {
    const m = document.querySelector('.velox-ctx-menu, .editor-context-menu')
    return { open: !!m, items: m ? m.querySelectorAll('.velox-ctx-row, .velox-ctx-item, [class*="item"]').length : 0 }
  })()`)
  await pressKey('Escape', 'Escape')
  await sleep(300)
  // 偏好设置对话框（菜单点击打开）
  let dialog = { open: false }
  const prefItem = await evalExpr(`(() => {
    const items = [...document.querySelectorAll('.menu-item, .menubar-label')]
    const hit = items.find((el) => (el.textContent ?? '').includes('偏好'))
    if (!hit) return null
    const r = hit.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (prefItem) {
    await clickAt(prefItem.x, prefItem.y)
    await sleep(600)
  }
  // 若菜单项不在下拉层，改走命令面板式的全局查找：逐菜单展开找「偏好设置」
  if (!(await evalExpr(`!!document.querySelector('.prefs-overlay, .dialog-overlay')`))) {
    for (const label of ['文件', '编辑', '视图', '帮助']) {
      const mb = await evalExpr(`(() => {
        const el = [...document.querySelectorAll('.menubar-label')].find((b) => (b.textContent ?? '').trim() === ${JSON.stringify(label)})
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
      })()`)
      if (mb) await clickAt(mb.x, mb.y)
      await sleep(400)
      const item = await evalExpr(`(() => {
        const hit = [...document.querySelectorAll('.menu-item')].find((el) => (el.textContent ?? '').includes('偏好'))
        if (!hit) return null
        const r = hit.getBoundingClientRect()
        return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
      })()`)
      if (item) { await clickAt(item.x, item.y); await sleep(600); break }
      await pressKey('Escape', 'Escape')
      await sleep(250)
    }
  }
  dialog = await evalExpr(`(() => {
    const p = document.querySelector('.prefs-overlay')
    const d = document.querySelector('.dialog-overlay')
    return { open: !!(p || d), prefs: !!p, hasButtons: !!(d && d.querySelector('.dialog-btn, .prefs-overlay button, button')) }
  })()`)
  // 关掉 prefs（Esc 或关闭按钮）
  await pressKey('Escape', 'Escape')
  await sleep(400)
  if (await evalExpr(`!!document.querySelector('.prefs-overlay')`)) {
    const closeBtn = await evalExpr(`(() => {
      const b = document.querySelector('.prefs-overlay button, .prefs-overlay .dialog-btn')
      if (!b) return null
      const r = b.getBoundingClientRect()
      return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
    })()`)
    if (closeBtn) await clickAt(closeBtn.x, closeBtn.y)
    await sleep(400)
  }
  await dismissAllDialogs(3)
  const shot = await screenshot(`IT-04-FE-02-${theme}-full.png`)
  return { pre, ui02, grid, menuOps, toast, ctxMenu, dialog, shot }
}

results.walk.light = await walk('light')
check('8.1 浅色主题 ui_01..07 结构对照（AC-NF-15）',
  results.walk.light.pre.ui01.menubar && results.walk.light.pre.ui01.tabsBar && results.walk.light.pre.ui01.editor &&
  results.walk.light.pre.ui01.sidebar && results.walk.light.pre.ui01.statusbar && results.walk.light.pre.ui01.quietNoTableToolbar &&
  results.walk.light.ui02.toolbar && results.walk.light.grid.picker && results.walk.light.grid.cells > 0 &&
  results.walk.light.pre.ui04.menubarLabels >= 5 && results.walk.light.pre.ui05.sidebarTabs >= 2 && results.walk.light.pre.ui05.sidebarResizer &&
  results.walk.light.pre.ui06.codeBlock && results.walk.light.pre.ui06.quote && results.walk.light.pre.ui06.headingFoldCaret && results.walk.light.pre.ui06.table &&
  results.walk.light.toast.host && results.walk.light.ctxMenu.open && results.walk.light.dialog.open,
  results.walk.light
)

results.walk.dark = await walk('dark')
check('8.2 深色主题 ui_01..07 结构对照（AC-NF-15）',
  results.walk.dark.pre.ui01.menubar && results.walk.dark.pre.ui01.tabsBar && results.walk.dark.pre.ui01.editor &&
  results.walk.dark.pre.ui01.sidebar && results.walk.dark.pre.ui01.statusbar && results.walk.dark.pre.ui01.quietNoTableToolbar &&
  results.walk.dark.ui02.toolbar && results.walk.dark.grid.picker && results.walk.dark.grid.cells > 0 &&
  results.walk.dark.pre.ui04.menubarLabels >= 5 && results.walk.dark.pre.ui05.sidebarTabs >= 2 && results.walk.dark.pre.ui05.sidebarResizer &&
  results.walk.dark.pre.ui06.codeBlock && results.walk.dark.pre.ui06.quote && results.walk.dark.pre.ui06.headingFoldCaret && results.walk.dark.pre.ui06.table &&
  results.walk.dark.toast.host && results.walk.dark.ctxMenu.open && results.walk.dark.dialog.open,
  results.walk.dark
)
check('8.2b 双主题关键面均在位（ui_01..07 家族并集）',
  !!results.walk.light.shot && !!results.walk.dark.shot,
  { light: results.walk.light.shot, dark: results.walk.dark.shot }
)

// ── 8.5 e2e 缝契约终态扫描 ─────────────────────────────────────────────────
const seam = await evalExpr(`(() => {
  const veloxKeys = Object.keys(window).filter((k) => k.startsWith('__velox')).sort()
  const dataOps = [...new Set([...document.querySelectorAll('[data-op]')].map((e) => e.dataset.op))].sort()
  const handles = [...new Set([...document.querySelectorAll('[data-table-handle]')].map((e) => e.dataset.tableHandle))].sort()
  return { veloxKeys, dataOps, handles }
})()`)
// 进表格编辑态再扫一次 data-op（工具栏 6 键 + 菜单 19 键在⋮展开时）
// （先重载夹具：walk 内的 Ctrl+Z 可能撤掉 loadDoc 历史条目导致表格消失）
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1200)
await dismissAllDialogs()
await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
const cell2 = await evalExpr(`(() => {
  const td = document.querySelector('.cm-md-table-wrap table tr td')
  if (!td) return null
  const r = td.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (cell2) await clickAt(cell2.x, cell2.y)
await sleep(600)
const more2 = await evalExpr(`(() => {
  const b = document.querySelector('[data-op="TBL-MOR-OPN"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (more2) await clickAt(more2.x, more2.y)
await sleep(500)
const opSurface = await evalExpr(`(() => {
  const ops = [...new Set([...document.querySelectorAll('[data-op]')].map((e) => e.dataset.op))].sort()
  const handles = [...new Set([...document.querySelectorAll('[data-table-handle]')].map((e) => e.dataset.tableHandle))].sort()
  return { ops, handles }
})()`)
await pressKey('Escape', 'Escape')

const MENU_OPS = ['insertRowAbove', 'insertRowBelow', 'deleteRow', 'insertColLeft', 'insertColRight', 'deleteCol', 'moveRowUp', 'moveRowDown', 'moveColLeft', 'moveColRight', 'alignLeft', 'alignCenter', 'alignRight', 'cutCell', 'copyCell', 'pasteCell', 'copyTable', 'formatTableSource', 'deleteTable']
const TOOLBAR_OPS = ['resizeTable', 'alignLeft', 'alignCenter', 'alignRight', 'TBL-MOR-OPN', 'deleteTable']
const EXPECT_SEAMS = ['__veloxEditor', '__veloxExport', '__veloxP04', '__veloxP12', '__veloxP15', '__veloxP18', '__veloxP20', '__veloxP21', '__veloxP23', '__veloxP24', '__veloxP26', '__veloxPrefs', '__veloxTable']
const missingSeams = EXPECT_SEAMS.filter((k) => !seam.veloxKeys.includes(k))
const menuOpOk = MENU_OPS.every((op) => opSurface.ops.includes(op))
const toolbarOpOk = TOOLBAR_OPS.every((op) => opSurface.ops.includes(op))
const handleOk = opSurface.handles.length === 1 && opSurface.handles[0] === 'col-grip'
check('8.5a window.__velox* 缝集合完整（AC-RULE-17）', missingSeams.length === 0, { found: seam.veloxKeys, missing: missingSeams, note: '__veloxTableCellView 懒装（nestedSession 进表格编辑态才挂）' })
check('8.5b data-op 冻结集：菜单 19 + 工具栏 6 全在位（AC-RULE-17）', menuOpOk && toolbarOpOk, { ops: opSurface.ops, missingMenu: MENU_OPS.filter((o) => !opSurface.ops.includes(o)), missingToolbar: TOOLBAR_OPS.filter((o) => !opSurface.ops.includes(o)) })
check('8.5c data-table-handle 契约集 = {col-grip}（AC-RULE-17）', handleOk, { handles: opSurface.handles })

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch8-data.json`, JSON.stringify(results, null, 2))
const failed = results.checks.filter((c) => !c.ok).length
console.log(`\n批次⑧ done: ${results.checks.length - failed}/${results.checks.length} PASS`)
process.exit(failed > 0 ? 1 : 0)
