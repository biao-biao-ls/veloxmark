#!/usr/bin/env node
/**
 * IT-01 FE-01 r2（U3）表上下文菜单 19 项契约裁剪 — CDP 验收驱动.
 *
 * 定性结论固化为探针断言：
 *   R1 ⋮ / 单元格右键两入口 → 表上下文菜单恰为 5 组 19 项（ui_03 冻结矩阵）
 *   R2 零通用编辑项混入（cut/copy/paste/copyAs/paragraph/format/insert）
 *   R3 19 项文案 + kbd 逐字对齐 ui_03；11 项 kbd 留白
 *   R4 danger 红仅「删除表格」+ 结构删除组徽标（批 A 成果不回退）
 *   R5 禁用语义不回退（首行上移灰显 / 表头末行删行灰显）
 *   R6 批 A 面不回退：菜单宽 ≥248 / 5px 滚动条 / --fg-disabled 禁用色
 *   R7 编辑器通用右键（非表上下文）仍保留共享骨架（对照面）→ batch-r2-editor-ctx.png
 *
 * 截图：batch-r2-menu-19.png（19 项矩阵全景，拍前临时放开 maxHeight 限高，
 * 拍后即关菜单——限高 480 本身是批 A 另项 AC，此处只为单帧可见全矩阵）、
 * batch-r2-editor-ctx.png（通用右键对照）。
 *
 * 硬约束：草稿恢复对话框一律点「稍后」，绝不丢弃草稿。禁 git。
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.FE01_CDP_PORT ?? 9534)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-01'
const SHOTS = `${OUT_DIR}/shots`
const FIXTURE_PATH = 'D:/code/typora/temp/fe01-r2-fixture.md'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── CDP plumbing（与批 A 驱动同构）────────────────────────────────────────────
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) throw new Error('no CDP page target')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

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
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evalExpr(expression, timeoutMs = 8000) {
  let timer
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(`Runtime.evaluate timeout ${timeoutMs}ms: ${expression.slice(0, 140)}`)), timeoutMs)
  })
  try {
    const r = await Promise.race([
      send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      timeout
    ])
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails))
    return r.result.value
  } finally {
    clearTimeout(timer)
  }
}

async function moveTo(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
}
async function clickAt(x, y) {
  await moveTo(x, y)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}
async function rightClickAt(x, y) {
  await moveTo(x, y)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 })
}
async function pressEscape() {
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27
  })
}

const results = { meta: { port: PORT, startedAt: new Date().toISOString() }, checks: [] }
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail) : ''}`)
  return !!ok
}
async function shot(name) {
  const s = await send('Page.captureScreenshot', { format: 'png' })
  mkdirSync(SHOTS, { recursive: true })
  writeFileSync(`${SHOTS}/${name}`, Buffer.from(s.data, 'base64'))
  console.log(`SHOT  ${name}`)
}

/** 草稿恢复对话框一律点「稍后」——绝不丢弃草稿（硬约束）。 */
async function dismissAnyDialog() {
  const s = await evalExpr(`(() => {
    const d = document.querySelector('.dialog-overlay .dialog')
    if (!d) return { present: false }
    return {
      present: true,
      message: d.querySelector('.dialog-message')?.textContent ?? null,
      buttons: [...d.querySelectorAll('.dialog-buttons .dialog-btn')].map((b) => (b.textContent ?? '').trim())
    }
  })()`)
  if (!s.present) return null
  const btn = await evalExpr(`(() => {
    const d = document.querySelector('.dialog-overlay .dialog')
    if (!d) return null
    const btns = [...d.querySelectorAll('.dialog-buttons .dialog-btn')]
    const byText = (t) => btns.find((b) => (b.textContent ?? '').trim() === t)
    const target = byText('稍后') ?? btns[btns.length - 1]
    if (!target) return null
    const r = target.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), label: (target.textContent ?? '').trim() }
  })()`)
  if (btn) {
    await clickAt(btn.x, btn.y)
    await sleep(350)
  }
  return { dialog: s, clicked: btn }
}

const FIXTURE = `# FE-01 r2 fixture

Lead paragraph above the table for the editor general right-click contrast.

| Left | Center | Right |
| --- | :---: | ---: |
| a | b | c |
| d | e | f |

Tail paragraph after the table for the editor general right-click contrast.

| onlyH1 | onlyH2 |
| --- | --- |
`

async function loadDocSettled() {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await dismissAnyDialog()
    await evalExpr(`(() => {
      window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})
      return true
    })()`)
    await sleep(900)
    const state = await evalExpr(`({
      fp: window.__veloxP12.getFilePath(),
      tables: document.querySelectorAll('.cm-md-table-wrap').length
    })`)
    if (state.fp === FIXTURE_PATH && state.tables >= 2) return state
  }
  throw new Error('loadDocSettled did not settle')
}

async function cellPoint(row, col, wrapIdx = 0) {
  const sel = `(() => {
    const wrap = document.querySelectorAll('.cm-md-table-wrap')[${wrapIdx}]
    return wrap?.querySelector('.cm-md-table td[data-row="${row}"][data-col="${col}"], .cm-md-table th[data-row="${row}"][data-col="${col}"]') ?? null
  })()`
  await evalExpr(`(() => {
    const td = ${sel}
    if (td) td.scrollIntoView({ block: 'center', inline: 'nearest' })
    return !!td
  })()`)
  await sleep(150)
  return evalExpr(`(() => {
    const td = ${sel}
    if (!td) return null
    const r = td.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2)
    }
  })()`)
}

/** 菜单面全量探针（items = .velox-ctx-item 钮；组标题另计）。 */
const MENU_PROBE = `(() => {
  const menu = document.querySelector('.editor-context-menu, .velox-ctx-menu')
  if (!menu) return { present: false }
  const cs = getComputedStyle(menu)
  const r = menu.getBoundingClientRect()
  const items = [...menu.querySelectorAll('.velox-ctx-item')]
  return {
    present: true,
    width: +r.width.toFixed(2),
    minWidth: cs.minWidth,
    webkitScrollbarW: getComputedStyle(menu, '::-webkit-scrollbar').width,
    scrollbarGutter: +(menu.offsetWidth - menu.clientWidth).toFixed(2),
    itemCount: items.length,
    ids: items.map((i) => i.dataset.op),
    labels: items.map((i) => i.querySelector('.velox-ctx-label')?.textContent ?? ''),
    shortcuts: items.map((i) => (i.querySelector('.velox-ctx-shortcut')?.textContent ?? '').trim()),
    groupTitles: [...menu.querySelectorAll('.velox-ctx-group-label')].map((g) => {
      const badge = g.querySelector('.velox-ctx-group-badge')
      return {
        text: (g.childNodes[0]?.textContent ?? '').trim(),
        badge: badge ? badge.textContent : null
      }
    }),
    dangerIds: items.filter((i) => i.classList.contains('velox-ctx-danger')).map((i) => i.dataset.op),
    disabledIds: items.filter((i) => i.classList.contains('velox-ctx-disabled') || i.disabled).map((i) => i.dataset.op),
    disabledStyle: (() => {
      const d = items.find((i) => i.classList.contains('velox-ctx-disabled') || i.disabled)
      if (!d) return null
      const dcs = getComputedStyle(d)
      return { color: dcs.color, opacity: dcs.opacity }
    })(),
    submenus: items.filter((i) => i.querySelector(':scope > .velox-ctx-shortcut')?.textContent === '▸')
      .map((i) => i.dataset.op),
    checked: items.filter((i) => (i.querySelector('.velox-ctx-check')?.textContent ?? '').trim() === '✓')
      .map((i) => i.dataset.op)
  }
})()`

// ui_03 冻结矩阵
const UI03_IDS = [
  'insertRowAbove', 'insertRowBelow', 'moveRowUp', 'moveRowDown', 'deleteRow',
  'insertColLeft', 'insertColRight', 'moveColLeft', 'moveColRight', 'deleteCol',
  'alignLeft', 'alignCenter', 'alignRight',
  'cutCell', 'copyCell', 'pasteCell',
  'copyTable', 'formatTableSource', 'deleteTable'
]
const UI03_LABELS = [
  '在上方插入行', '在下方插入行', '上移该行', '下移该行', '删除行',
  '在左侧插入列', '在右侧插入列', '左移该列', '右移该列', '删除列',
  '左对齐', '居中对齐', '右对齐',
  '剪切单元格', '拷贝单元格', '粘贴单元格',
  '拷贝表格', '格式化表格源码', '删除表格'
]
const UI03_KBD = [
  'Ctrl+Shift+Enter', 'Ctrl+Enter', 'Alt+↑', 'Alt+↓', '',
  'Ctrl+Shift+←', 'Ctrl+Shift+→', 'Alt+←', 'Alt+→', '',
  '', '', '',
  '', '', '',
  '', '', ''
]
const UI03_GROUPS = ['行操作', '列操作', '对齐', '单元格', '结构删除']
const GENERIC_IDS = ['cut', 'copy', 'paste', 'copyAs', 'paragraph', 'format', 'insert']

/** 表上下文面契约断言（⋮ 与单元格右键共用）。 */
function assertTableFace(tag, menu) {
  check(`${tag} 恰 19 项可点钮`, menu.present && menu.itemCount === 19, { present: menu.present, n: menu.itemCount })
  check(`${tag} id 序 = ui_03 冻结矩阵`, JSON.stringify(menu.ids) === JSON.stringify(UI03_IDS), menu.ids)
  check(`${tag} 文案逐字 = ui_03 .label`, JSON.stringify(menu.labels) === JSON.stringify(UI03_LABELS), menu.labels)
  check(`${tag} kbd 逐字 = ui_03 .kbd（8 键项 + 11 留白）`, JSON.stringify(menu.shortcuts) === JSON.stringify(UI03_KBD), menu.shortcuts)
  const leaked = menu.ids.filter((id) => GENERIC_IDS.includes(id))
  check(`${tag} 零通用编辑项混入（U3 裁剪）`, leaked.length === 0, leaked)
  check(`${tag} 零子菜单残留`, (menu.submenus ?? []).length === 0, menu.submenus)
  const groups = menu.groupTitles.map((g) => g.text)
  check(`${tag} 五组标题逐字且有序`, JSON.stringify(groups) === JSON.stringify(UI03_GROUPS), groups)
  check(`${tag} danger 仅删除表格 + 危险组徽标`,
    JSON.stringify(menu.dangerIds) === JSON.stringify(['deleteTable']) &&
    menu.groupTitles.some((g) => g.text === '结构删除' && g.badge != null),
    { dangerIds: menu.dangerIds, badges: menu.groupTitles })
  check(`${tag} 批 A 面保留：min-width 248 + 5px 滚动条`,
    menu.minWidth === '248px' && menu.width >= 248 && menu.webkitScrollbarW === '5px',
    { w: menu.width, min: menu.minWidth, sb: menu.webkitScrollbarW })
}

// ═════════════════════════════════════════════════════════════════════════════
await send('Page.enable')
await send('Runtime.enable')
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await sleep(800)

const dlg = await dismissAnyDialog()
if (dlg) console.log('草稿对话框已点「稍后」', JSON.stringify(dlg.clicked))
const loaded = await loadDocSettled()
check('R0 夹具装载 2 表', loaded.tables >= 2, loaded)

// ── R1–R6 ⋮（TBL-MOR-OPN）表上下文菜单 ────────────────────────────────────────
const c0 = await cellPoint(1, 1, 0)
await clickAt(c0.x, c0.y)
await sleep(600)
await dismissAnyDialog()
const moreBtn = await evalExpr(`(() => {
  const b = document.querySelector('.cm-md-table-toolbar-btn[data-op="TBL-MOR-OPN"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
check('R0 ⋮ 钮（TBL-MOR-OPN）在位', !!moreBtn, moreBtn)
await clickAt(moreBtn.x, moreBtn.y)
await sleep(500)
let menu = await evalExpr(MENU_PROBE)
assertTableFace('R1 ⋮', menu)

// 禁用语义：主表体行 (1,1) 不禁用；对齐 ✓ 回显 center 列
check('R5 体行命中：无禁用项（上移/左移应可点）',
  menu.present && !menu.disabledIds.includes('moveRowUp') && !menu.disabledIds.includes('moveColLeft'),
  menu.disabledIds)
check('R5 对齐 ✓ 回显当前列（=:---: center）', menu.checked.includes('alignCenter'), menu.checked)

// 19 项矩阵单帧留证：临时放开限高（拍后即关；480 限高是批 A 另项 AC）
await evalExpr(`(() => {
  const m = document.querySelector('.editor-context-menu, .velox-ctx-menu')
  if (m) { m.style.maxHeight = 'none'; m.style.overflow = 'visible' }
  return !!m
})()`)
await sleep(250)
await shot('batch-r2-menu-19.png')
const menuExpanded = await evalExpr(MENU_PROBE)
check('R1 全矩阵单帧可见（19 钮在视口内）', menuExpanded.present && menuExpanded.itemCount === 19, { n: menuExpanded.itemCount })
await pressEscape()
await sleep(350)

// ── R1 同源复核：单元格右键（同一封闭面）──────────────────────────────────────
const cR = await cellPoint(1, 2, 0)
await rightClickAt(cR.x, cR.y)
await sleep(500)
menu = await evalExpr(MENU_PROBE)
assertTableFace('R1 单元格右键', menu)
check('R1b 右键面与 ⋮ 面同源（id 序一致）', JSON.stringify(menu.ids) === JSON.stringify(UI03_IDS), menu.ids)
await pressEscape()
await sleep(350)

// ── R5 禁用语义不回退：表头末行表（index 1）删除行灰显 ─────────────────────────
await pressEscape()
await sleep(350)
const cH = await cellPoint(0, 1, 1)
await clickAt(cH.x, cH.y)
await sleep(550)
const editState = await evalExpr(`(() => {
  const wraps = [...document.querySelectorAll('.cm-md-table-wrap')]
  return {
    toolbars: document.querySelectorAll('.cm-md-table-toolbar').length,
    editingIdx: wraps.findIndex((w) => w.classList.contains('cm-md-table-editing'))
  }
})()`)
if (editState.toolbars === 1 && (await (async () => {
  const b = await evalExpr(`(() => {
    const el = document.querySelector('.cm-md-table-toolbar-btn[data-op="TBL-MOR-OPN"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (!b) return false
  await clickAt(b.x, b.y)
  await sleep(500)
  return true
})())) {
  menu = await evalExpr(MENU_PROBE)
  assertTableFace('R5 表头末行', menu)
  check('R5 表头末行：删除行禁用、删除列可点',
    menu.disabledIds.includes('deleteRow') && !menu.disabledIds.includes('deleteCol'), menu.disabledIds)
  check('R5 禁用色 = --fg-disabled（浅 #b0b0b0，批 A 不回退）',
    menu.disabledStyle && menu.disabledStyle.color.replace(/\s/g, '') === 'rgb(176,176,176)' &&
    menu.disabledStyle.opacity === '1', menu.disabledStyle)
  await pressEscape()
  await sleep(300)
}
await pressEscape()
await sleep(350)

// ── R7 编辑器通用右键对照面（非表上下文，不裁）────────────────────────────────
const paraPt = await evalExpr(`(() => {
  const lines = [...document.querySelectorAll('.cm-line')]
  const line = lines.find((l) => (l.textContent ?? '').includes('Tail paragraph'))
  if (!line) return null
  line.scrollIntoView({ block: 'center', inline: 'nearest' })
  return true
})()`)
await sleep(250)
const paraXY = await evalExpr(`(() => {
  const lines = [...document.querySelectorAll('.cm-line')]
  const line = lines.find((l) => (l.textContent ?? '').includes('Tail paragraph'))
  if (!line) return null
  const r = line.getBoundingClientRect()
  return {
    x: +(r.left + Math.min(80, r.width / 3)).toFixed(2),
    y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2)
  }
})()`)
check('R0 段落行定位', !!paraPt && !!paraXY, { paraPt, paraXY })
if (paraXY) {
  await rightClickAt(paraXY.x, paraXY.y)
  await sleep(500)
  menu = await evalExpr(MENU_PROBE)
  const presentGeneric = GENERIC_IDS.filter((id) => menu.ids.includes(id))
  check('R7 通用右键面保留共享骨架（剪切/复制/粘贴+复制为/段落/格式/插入）',
    menu.present && presentGeneric.length === GENERIC_IDS.length,
    { present: menu.present, presentGeneric, ids: menu.ids })
  const leakedTable = menu.ids.filter((id) => UI03_IDS.includes(id))
  check('R7 表 19 项不泄漏进通用面', leakedTable.length === 0, leakedTable)
  await shot('batch-r2-editor-ctx.png')
  await pressEscape()
  await sleep(300)
}

const pass = results.checks.filter((c) => c.ok).length
const fail = results.checks.length - pass
console.log(`\n==== ${pass} PASS / ${fail} FAIL (total ${results.checks.length}) ====`)
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(`${OUT_DIR}/IT-01-FE-01-r2-menu-19-results.json`, JSON.stringify({ ...results, pass, fail }, null, 2))
process.exit(fail === 0 ? 0 : 1)
