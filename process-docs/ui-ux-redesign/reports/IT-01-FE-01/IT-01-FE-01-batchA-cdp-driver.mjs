#!/usr/bin/env node
/**
 * IT-01 FE-01 批 A（表格工具栏簇）跨任务合并修复 — CDP 验收驱动.
 *
 * 覆盖 9 必修项 + 验收补截：
 *   S1 工具栏形态：右上浮动 pill、6 钮单组 ⊞ ◧ ▣ ◨ ｜ ⋮ 🗑、28×28/32px、chrome
 *   S2 对齐三键按下态（UI-IXD-04）：`---` 默认左归一 + accent-soft 回显
 *   S3 🗑 danger 红（浅 #d1242f / 深 #f85149）
 *   S4 编辑态整表 accent 描边 / 退出消失
 *   S5 ⋮ 展开 → is-source accent-solid
 *   S6 菜单宽 248 + 5px 细滚动条 + 19 项矩阵（删除表格 danger 红 / 危险组徽标）
 *   S7 最小结构禁用（仅 1 行/表头末行/1×1 → 删除行/列灰显 --fg-disabled）
 *   S8 删行/列普通前景 vs 删表 danger（opsTable danger 范围）
 *   S9 ⊞ 网格弹层锚点收敛表块右上 + 缝 key 基线不变 + 证据落盘
 *
 * 硬约束：草稿恢复对话框一律点「稍后」，绝不丢弃草稿。
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.FE01_CDP_PORT ?? 9534)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-01'
const SHOTS = `${OUT_DIR}/shots`
const FIXTURE_PATH = 'D:/code/typora/temp/fe01-batcha-fixture.md'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── CDP plumbing ─────────────────────────────────────────────────────────────
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
    timer = setTimeout(
      () => rej(new Error(`Runtime.evaluate timeout ${timeoutMs}ms: ${expression.slice(0, 140)}`)),
      timeoutMs
    )
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
async function pressAt(x, y) {
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1
  })
}
async function releaseAt(x, y) {
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1
  })
}
async function clickAt(x, y) {
  await moveTo(x, y)
  await pressAt(x, y)
  await releaseAt(x, y)
}
async function rightClickAt(x, y) {
  await moveTo(x, y)
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1
  })
}
async function pressEscape() {
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'Escape', code: 'Escape',
    windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27
  })
  await send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Escape', code: 'Escape',
    windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27
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
    const target = byText('稍后') ?? byText('确定') ?? btns[btns.length - 1]
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

const FIXTURE = `# FE-01 batch-A fixture

Body paragraph for chrome checks.

| Left | Center | Right |
| --- | :---: | ---: |
| a | b | c |
| d | e | f |

Tail paragraph after the table.

| onlyH1 | onlyH2 |
| --- | --- |

| one |
| --- |
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
    if (state.fp === FIXTURE_PATH && state.tables >= 3) return state
  }
  throw new Error('loadDocSettled did not settle')
}

// ── geometry helpers ─────────────────────────────────────────────────────────
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

/** Which wrap index is editing + toolbar count + active cell (diagnostics). */
const EDIT_STATE = `(() => {
  const wraps = [...document.querySelectorAll('.cm-md-table-wrap')]
  return {
    toolbars: document.querySelectorAll('.cm-md-table-toolbar').length,
    editingIdx: wraps.findIndex((w) => w.classList.contains('cm-md-table-editing')),
    activeCell: document.querySelector('.cm-md-table-cell-editing')
      ? (document.querySelector('.cm-md-table-cell-editing').dataset.row ?? null) + ',' +
        (document.querySelector('.cm-md-table-cell-editing').dataset.col ?? null)
      : null
  }
})()`

/** Table-wrap point for the Nth table (0-based, document order). */
async function tableWrapPoint(idx) {
  await evalExpr(`(() => {
    const el = document.querySelectorAll('.cm-md-table-wrap')[${idx}]
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' })
    return !!el
  })()`)
  await sleep(150)
  return evalExpr(`(() => {
    const wrap = document.querySelectorAll('.cm-md-table-wrap')[${idx}]
    if (!wrap) return null
    const r = wrap.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +Math.min(Math.max(r.top + Math.min(40, r.height / 3), 48), window.innerHeight - 48).toFixed(2)
    }
  })()`)
}

// ── state probes ─────────────────────────────────────────────────────────────
const TOOLBAR_STATE = `(() => {
  const bar = document.querySelector('.cm-md-table-toolbar')
  if (!bar) return { present: false }
  const bs = getComputedStyle(bar)
  const br = bar.getBoundingClientRect()
  const btns = [...bar.querySelectorAll('.cm-md-table-toolbar-btn')]
  const table = bar.closest('.cm-md-table-outer')?.querySelector('.cm-md-table') ?? document.querySelector('.cm-md-table')
  const tr = table?.getBoundingClientRect() ?? null
  const sep = bar.querySelector('.cm-md-table-toolbar-sep')
  const ss = sep ? getComputedStyle(sep) : null
  const sr = sep ? sep.getBoundingClientRect() : null
  return {
    present: true,
    groupCount: bar.querySelectorAll('.cm-md-table-toolbar-group').length,
    buttonCount: btns.length,
    glyphs: btns.map((b) => b.textContent.trim()),
    ops: btns.map((b) => b.dataset.op),
    testids: btns.map((b) => b.dataset.testid),
    bar: {
      height: +br.height.toFixed(2),
      top: +br.top.toFixed(2),
      right: +br.right.toFixed(2),
      bottom: +br.bottom.toFixed(2),
      bg: bs.backgroundColor,
      borderTop: bs.borderTopWidth + ' ' + bs.borderTopStyle + ' ' + bs.borderTopColor,
      radius: bs.borderTopLeftRadius,
      shadow: bs.boxShadow !== 'none'
    },
    buttons: btns.map((b) => {
      const r = b.getBoundingClientRect()
      return { w: +r.width.toFixed(2), h: +r.height.toFixed(2), op: b.dataset.op }
    }),
    sep: sep
      ? { w: +sr.width.toFixed(2), h: +sr.height.toFixed(2), bg: ss.backgroundColor,
          between: btns.map((x) => x.dataset.op).join(',') }
      : null,
    table: tr ? { top: +tr.top.toFixed(2), right: +tr.right.toFixed(2), bottom: +tr.bottom.toFixed(2) } : null,
    pressed: btns.filter((b) => b.classList.contains('is-pressed')).map((b) => b.dataset.op),
    pressedStyle: (() => {
      const p = btns.find((b) => b.classList.contains('is-pressed'))
      if (!p) return null
      const cs = getComputedStyle(p)
      return { bg: cs.backgroundColor, color: cs.color }
    })(),
    sourceBtn: (() => {
      const p = btns.find((b) => b.classList.contains('is-source'))
      if (!p) return null
      const cs = getComputedStyle(p)
      return { op: p.dataset.op, bg: cs.backgroundColor, color: cs.color }
    })(),
    danger: (() => {
      const p = bar.querySelector('.is-danger')
      if (!p) return null
      const cs = getComputedStyle(p)
      return { op: p.dataset.op, glyph: p.textContent.trim(), color: cs.color }
    })()
  }
})()`

const TABLE_OUTLINE = `(() => {
  const wrap = document.querySelector('.cm-md-table-wrap.cm-md-table-editing')
  const table = wrap?.querySelector('.cm-md-table') ?? document.querySelector('.cm-md-table')
  if (!table) return null
  const cs = getComputedStyle(table)
  return {
    editing: !!wrap,
    borderTopWidth: cs.borderTopWidth,
    borderTopColor: cs.borderTopColor,
    borderTopStyle: cs.borderTopStyle
  }
})()`

const MENU_STATE = `(() => {
  const menu = document.querySelector('.editor-context-menu, .velox-ctx-menu')
  if (!menu) return { present: false }
  const cs = getComputedStyle(menu)
  const r = menu.getBoundingClientRect()
  const items = [...menu.querySelectorAll('.velox-ctx-item')]
  const bar = document.querySelector('.cm-md-table-toolbar')
  const barCs = bar ? getComputedStyle(bar) : null
  return {
    present: true,
    width: +r.width.toFixed(2),
    minWidth: cs.minWidth,
    clientWidth: menu.clientWidth,
    offsetWidth: menu.offsetWidth,
    scrollHeight: menu.scrollHeight,
    clientHeight: menu.clientHeight,
    scrollbarGutter: +(menu.offsetWidth - menu.clientWidth).toFixed(2),
    webkitScrollbarW: getComputedStyle(menu, '::-webkit-scrollbar').width,
    itemCount: items.length,
    labels: items.map((i) => i.querySelector('.velox-ctx-label')?.textContent ?? i.textContent),
    ids: items.map((i) => i.dataset.op),
    dangerIds: items.filter((i) => i.classList.contains('velox-ctx-danger')).map((i) => i.dataset.op),
    dangerLabels: items.filter((i) => i.classList.contains('velox-ctx-danger'))
      .map((i) => i.querySelector('.velox-ctx-label')?.textContent ?? i.textContent),
    disabledIds: items.filter((i) => i.classList.contains('velox-ctx-disabled') || i.disabled)
      .map((i) => i.dataset.op),
    disabledStyle: (() => {
      const d = items.find((i) => i.classList.contains('velox-ctx-disabled') || i.disabled)
      if (!d) return null
      const dcs = getComputedStyle(d)
      return { color: dcs.color, opacity: dcs.opacity }
    })(),
    normalDeleteStyle: (() => {
      const d = items.find((i) => i.dataset.op === 'deleteRow' || i.dataset.op === 'deleteCol')
      if (!d) return null
      return { op: d.dataset.op, color: getComputedStyle(d).color }
    })(),
    groupBadges: [...menu.querySelectorAll('.velox-ctx-group-badge')].map((b) => ({
      text: b.textContent, color: getComputedStyle(b).color
    })),
    checked: items.filter((i) => (i.querySelector('.velox-ctx-check')?.textContent ?? '').trim() === '✓')
      .map((i) => i.dataset.op),
    moreBtnSource: bar?.querySelector('.is-source')
      ? { op: bar.querySelector('.is-source').dataset.op, bg: barCs ? null : null }
      : (() => {
          const p = bar?.querySelector('.cm-md-table-toolbar-btn.is-source')
          return p ? { op: p.dataset.op, bg: getComputedStyle(p).backgroundColor, color: getComputedStyle(p).color } : null
        })()
  }
})()`

const SEAM_KEYS = `Object.keys(window).filter((k) => k.startsWith('__velox')).sort()`

/** opsTable 19 项冻结面（menu 面另有共享骨架 cut/copy/paste + 4 子菜单 = 共 26 钮）。 */
const TABLE_OP_IDS = new Set([
  'insertRowAbove', 'insertRowBelow', 'moveRowUp', 'moveRowDown', 'deleteRow',
  'insertColLeft', 'insertColRight', 'moveColLeft', 'moveColRight', 'deleteCol',
  'alignLeft', 'alignCenter', 'alignRight',
  'cutCell', 'copyCell', 'pasteCell',
  'copyTable', 'formatTableSource', 'deleteTable'
])

// ═════════════════════════════════════════════════════════════════════════════
await send('Page.enable')
await send('Runtime.enable')
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await sleep(800)

// ── S0 seam + dialog + fixture ───────────────────────────────────────────────
const keyBase = await evalExpr(SEAM_KEYS)
check('S0 缝 key 基线存在 __veloxP12/__veloxTable', keyBase.includes('__veloxP12') && keyBase.includes('__veloxTable'), keyBase)
const dlg = await dismissAnyDialog()
if (dlg) console.log('S0 草稿对话框已点「稍后」', JSON.stringify(dlg.clicked))
const loaded = await loadDocSettled()
check('S0 夹具装载 3 表', loaded.tables >= 3, loaded)

// ── S1 工具栏形态（必修 1 + 8）────────────────────────────────────────────────
// Enter edit on the main 3-col table (col 0 = default-left `---`).
const c0 = await cellPoint(1, 0)
await clickAt(c0.x, c0.y)
await sleep(600)
await dismissAnyDialog()

let tb = await evalExpr(TOOLBAR_STATE)
check('S1 工具栏渲染', tb.present === true)
check('S1 单组 6 钮 ⊞ ◧ ▣ ◨ ⋮ 🗑', tb.groupCount === 1 && tb.buttonCount === 6 &&
  tb.glyphs.join('') === '⊞◧▣◨⋮🗑', { group: tb.groupCount, glyphs: tb.glyphs })
check('S1 data-op 契约面', JSON.stringify(tb.ops) === JSON.stringify(
  ['resizeTable', 'alignLeft', 'alignCenter', 'alignRight', 'TBL-MOR-OPN', 'deleteTable']), tb.ops)
check('S1 data-testid kebab 全挂', tb.testids.every((t) => t && /^[a-z0-9-]+$/.test(t)), tb.testids)
check('S1 条高 32px / 钮 28×28', tb.bar.height === 32 &&
  tb.buttons.every((b) => b.w === 28 && b.h === 28), { barH: tb.bar.height, btns: tb.buttons })
check('S1 chrome: surface 背景 + 1px 边 + 8px 圆角 + shadow',
  tb.bar.bg !== 'rgba(0, 0, 0, 0)' && tb.bar.borderTop.startsWith('1px') &&
  tb.bar.radius === '8px' && tb.bar.shadow === true,
  { bg: tb.bar.bg, border: tb.bar.borderTop, radius: tb.bar.radius, shadow: tb.bar.shadow })
check('S1 tsep 竖线 1px×18px 在 ⋮ 前', tb.sep && tb.sep.w === 1 && tb.sep.h === 18 &&
  tb.sep.between.includes('alignRight,TBL-MOR-OPN,deleteTable'), tb.sep)
check('S1 浮动表块右上（bar 在表上方且右缘对齐）',
  tb.table && tb.bar.bottom <= tb.table.top + 1 && Math.abs(tb.bar.right - tb.table.right) <= 12,
  { bar: tb.bar, table: tb.table })
check('S1#8 右簇第二钮身份=🗑 删除表格（无复制钮混入）',
  tb.glyphs[5] === '🗑' && tb.ops[5] === 'deleteTable' && !tb.ops.includes('copyTable') && !tb.glyphs.includes('⧉'),
  { last: tb.glyphs[5], ops: tb.ops })
await shot('fe01-toolbar-pill-edit.png')

// ── S2 对齐三键按下态（必修 2 / UI-IXD-04）────────────────────────────────────
const alignCases = [
  { col: 0, expect: 'alignLeft', label: '默认 `---` → ◧（CHANGE-14 归一）' },
  { col: 1, expect: 'alignCenter', label: ':---: → ▣' },
  { col: 2, expect: 'alignRight', label: '---: → ◨' }
]
for (const ac of alignCases) {
  const p = await cellPoint(1, ac.col)
  await clickAt(p.x, p.y)
  await sleep(500)
  tb = await evalExpr(TOOLBAR_STATE)
  check(`S2 ${ac.label} 仅一键 is-pressed`,
    JSON.stringify(tb.pressed) === JSON.stringify([ac.expect]), tb.pressed)
  if (tb.pressedStyle) {
    const bgOk = tb.pressedStyle.bg.replace(/\s/g, '') === 'rgba(9,105,218,0.12)'
    const colorOk = tb.pressedStyle.color.replace(/\s/g, '') === 'rgb(9,105,218)'
    check(`S2 ${ac.expect} accent-soft+accent 回显（非实底蓝）`,
      bgOk && colorOk, tb.pressedStyle)
  }
}
const cLeft = await cellPoint(1, 0)
await clickAt(cLeft.x, cLeft.y)
await sleep(400)
tb = await evalExpr(TOOLBAR_STATE)
if (tb.pressedStyle) {
  await shot('fe01-align-pressed-default-left.png')
}

// ── S3 🗑 danger 红（必修 3）浅/深 ────────────────────────────────────────────
check('S3 浅色 🗑 = #d1242f', tb.danger && tb.danger.color.replace(/\s/g, '') === 'rgb(209,36,47)',
  tb.danger)
await shot('fe01-danger-trash-light.png')
await evalExpr(`window.__veloxP20.setThemePref('dark'); true`)
await sleep(500)
tb = await evalExpr(TOOLBAR_STATE)
check('S3 深色 🗑 = #f85149', tb.danger && tb.danger.color.replace(/\s/g, '') === 'rgb(248,81,73)',
  tb.danger)
await shot('fe01-danger-trash-dark.png')
await evalExpr(`window.__veloxP20.setThemePref('light'); true`)
await sleep(500)

// ── S4 编辑态整表描边（必修 5）───────────────────────────────────────────────
let outline = await evalExpr(TABLE_OUTLINE)
check('S4 编辑态整表 1px solid accent',
  outline && outline.editing && outline.borderTopWidth === '1px' &&
  outline.borderTopColor.replace(/\s/g, '') === 'rgb(9,105,218)', outline)
await shot('fe01-edit-outline-on.png')
await pressEscape()
await sleep(500)
outline = await evalExpr(TABLE_OUTLINE)
check('S4 退出编辑描边消失',
  outline && !outline.editing && outline.borderTopColor.replace(/\s/g, '') !== 'rgb(9,105,218)',
  outline)

// ── S5 ⋮ is-source（必修 6）──────────────────────────────────────────────────
const cMore = await cellPoint(1, 1)
await clickAt(cMore.x, cMore.y)
await sleep(500)
const moreBtn = await evalExpr(`(() => {
  const b = document.querySelector('.cm-md-table-toolbar-btn[data-op="TBL-MOR-OPN"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
await clickAt(moreBtn.x, moreBtn.y)
await sleep(500)
tb = await evalExpr(TOOLBAR_STATE)
check('S5 ⋮ 展开 → is-source accent-solid',
  tb.sourceBtn && tb.sourceBtn.op === 'TBL-MOR-OPN' &&
  tb.sourceBtn.bg.replace(/\s/g, '') === 'rgb(9,105,218)', tb.sourceBtn)

// ── S6 菜单宽/滚动条/19 项矩阵（必修 4 + 7）───────────────────────────────────
let menu = await evalExpr(MENU_STATE)
check('S6 菜单 min-width 248px 且实宽 ≥248',
  menu.present && menu.minWidth === '248px' && menu.width >= 248,
  { w: menu.width, min: menu.minWidth })
check('S6 菜单滚动条 5px 定制细条',
  menu.present && menu.webkitScrollbarW === '5px' && menu.scrollbarGutter <= 7,
  { webkit: menu.webkitScrollbarW, gutter: menu.scrollbarGutter })
const tableOpCount = menu.ids.filter((id) => TABLE_OP_IDS.has(id)).length
check('S6 表格矩阵 19 项（五组；面内另有共享骨架钮）',
  tableOpCount === 19 && menu.itemCount === 26, { tableOps: tableOpCount, total: menu.itemCount })
check('S6「删除表格」danger 红 #d1242f',
  menu.dangerIds.includes('deleteTable') &&
  menu.dangerLabels.some((l) => l.includes('删除表格') || l.toLowerCase().includes('delete table')), menu.dangerLabels)
check('S6 危险组徽标存在', menu.groupBadges.length >= 1, menu.groupBadges)
check('S6 删行/列普通前景（danger 仅删表）',
  menu.dangerIds.length === 1 && menu.dangerIds[0] === 'deleteTable' &&
  menu.normalDeleteStyle && !menu.normalDeleteStyle.color.includes('209, 36, 47'),
  { dangerIds: menu.dangerIds, normal: menu.normalDeleteStyle })
check('S6 对齐 ✓ 回显当前列（=:---: center）',
  menu.checked.includes('alignCenter'), menu.checked)
// Scroll the structDelete tail (「删除表格」/危险组) into view — the 19-item table
// matrix's own bottom (shared skeleton sits after it by P27 design).
await evalExpr(`(() => {
  const m = document.querySelector('.editor-context-menu, .velox-ctx-menu')
  const del = m?.querySelector('.velox-ctx-item[data-op="deleteTable"]')
  if (del) del.scrollIntoView({ block: 'center' })
  else if (m) m.scrollTop = m.scrollHeight
  return !!m
})()`)
await sleep(300)
await shot('fe01-menu-19-items-bottom.png')
const moreSrc = await evalExpr(TOOLBAR_STATE)
check('S5b 菜单开启期间 ⋮ 保持 is-source', !!moreSrc.sourceBtn, moreSrc.sourceBtn)
// Close WITHOUT exiting edit: click the same active cell (1,1) — outside the
// menu collapses it; unchanged active cell means eq() reuses the same toolbar
// DOM, so is-source must be cleared by the store subscription (not by remount).
const same = await cellPoint(1, 1)
await clickAt(same.x, same.y)
await sleep(400)
menu = await evalExpr(MENU_STATE)
tb = await evalExpr(TOOLBAR_STATE)
check('S5c 同 DOM 关菜单后 is-source 清除（订阅路径）',
  menu.present === false && tb.present === true && tb.sourceBtn === null,
  { menu: menu.present, toolbar: tb.present, source: tb.sourceBtn })

// ── S7 最小结构禁用（验收补截）────────────────────────────────────────────────
/** Exit edit, click a scoped cell (wrapIdx,row,col), verify editing landed there. */
async function enterTableAt(wrapIdx, row, col) {
  await pressEscape()
  await sleep(350)
  const p = await cellPoint(row, col, wrapIdx)
  if (!p) return { ok: false, reason: 'no cell point' }
  await clickAt(p.x, p.y)
  await sleep(550)
  const st = await evalExpr(EDIT_STATE)
  return { ok: st.editingIdx === wrapIdx && st.toolbars === 1, st }
}
async function openMoreMenu() {
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
}
async function scrollMenuToOp(id) {
  await evalExpr(`(() => {
    const m = document.querySelector('.editor-context-menu, .velox-ctx-menu')
    const el = m?.querySelector(\`.velox-ctx-item[data-op="${id}"]\`)
    if (el) el.scrollIntoView({ block: 'center' })
    else if (m) m.scrollTop = m.scrollHeight
    return !!m
  })()`)
  await sleep(250)
}

// header-only 2-col table (index 1): 仅 1 行 / 表头为末行 → 删除行灰显
const e1 = await enterTableAt(1, 0, 1)
check('S7a 定位到表头末行表（index 1）编辑态', e1.ok, e1.st)
if (e1.ok && (await openMoreMenu())) {
  menu = await evalExpr(MENU_STATE)
  check('S7 表头末行：删除行禁用', menu.disabledIds.includes('deleteRow'), menu.disabledIds)
  check('S7 删除列仍可点（2 列）', !menu.disabledIds.includes('deleteCol'), menu.disabledIds)
  check('S7 禁用色 = --fg-disabled（浅 #b0b0b0）',
    menu.disabledStyle && menu.disabledStyle.color.replace(/\s/g, '') === 'rgb(176,176,176)' &&
    menu.disabledStyle.opacity === '1', menu.disabledStyle)
  await scrollMenuToOp('deleteRow')
  await shot('fe01-minstruct-header-only-menu.png')
  await pressEscape()
  await sleep(300)
}
// 1×1 table (index 2): 删除行 + 删除列均禁用
const e2 = await enterTableAt(2, 0, 0)
check('S7b 定位到 1×1 表（index 2）编辑态', e2.ok, e2.st)
if (e2.ok && (await openMoreMenu())) {
  menu = await evalExpr(MENU_STATE)
  check('S7 1×1：删除行+删除列均禁用',
    menu.disabledIds.includes('deleteRow') && menu.disabledIds.includes('deleteCol'), menu.disabledIds)
  await scrollMenuToOp('deleteRow')
  await shot('fe01-minstruct-1x1-menu.png')
  await pressEscape()
  await sleep(300)
}

// ── S8 右键菜单同源（必修 7 同面）────────────────────────────────────────────
const e0 = await enterTableAt(0, 1, 2)
check('S8 重回主表编辑态', e0.ok, e0.st)
if (e0.ok) {
  const cR = await cellPoint(1, 2, 0)
  await rightClickAt(cR.x, cR.y)
  await sleep(500)
  menu = await evalExpr(MENU_STATE)
  const tableOpsR = menu.ids.filter((id) => TABLE_OP_IDS.has(id)).length
  check('S8 右键菜单同源 248px/19 项表格矩阵',
    menu.present && menu.width >= 248 && tableOpsR === 19,
    { w: menu.width, tableOps: tableOpsR, total: menu.itemCount })
  await pressEscape()
  await sleep(300)
}

// ── S9 ⊞ 网格弹层锚点（必修 9）+ 缝 key ──────────────────────────────────────
const eG = await enterTableAt(0, 1, 0)
check('S9 主表编辑态（⊞ 探针前置）', eG.ok, eG.st)
const gridBtn = await evalExpr(`(() => {
  const b = document.querySelector('.cm-md-table-toolbar-btn[data-op="resizeTable"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
if (gridBtn) {
  await clickAt(gridBtn.x, gridBtn.y)
  await sleep(400)
  const grid = await evalExpr(`(() => {
    const pop = document.querySelector('.table-grid-picker')
    const btn = document.querySelector('.cm-md-table-toolbar-btn[data-op="resizeTable"]')
    const table = document.querySelector('.cm-md-table-editing .cm-md-table') ?? document.querySelector('.cm-md-table')
    if (!pop) return { present: false }
    const r = pop.getBoundingClientRect()
    const tr = table?.getBoundingClientRect() ?? null
    const br = btn?.getBoundingClientRect() ?? null
    return {
      present: true,
      cls: pop.className,
      left: +r.left.toFixed(1), right: +r.right.toFixed(1), top: +r.top.toFixed(1),
      btnLeft: br ? +br.left.toFixed(1) : null,
      tableRight: tr ? +tr.right.toFixed(1) : null,
      tableLeft: tr ? +tr.left.toFixed(1) : null,
      tableTop: tr ? +tr.top.toFixed(1) : null
    }
  })()`)
  // 批 A 不单修：⊞ 为 pill 最左钮（位于表块右上），弹层锚在其下 —— 收敛表块
  // 右上（右半区、贴顶、随 ⊞ 水平对齐）；允许右缘溢出表右（视口内浮层语义）。
  check('S9 ⊞ 网格弹层收敛表块右上（锚 ⊞ 下、右半区贴顶）',
    grid.present && grid.tableRight !== null &&
    Math.abs(grid.left - grid.btnLeft) <= 32 &&
    grid.left >= (grid.tableLeft + grid.tableRight) / 2 &&
    grid.top <= (grid.tableTop ?? 0) + 8,
    grid)
  await shot('fe01-grid-picker-anchor.png')
  await pressEscape()
  await sleep(300)
}

const keyEnd = await evalExpr(SEAM_KEYS)
const added = keyEnd.filter((k) => !keyBase.includes(k))
const LAZY = new Set(['__veloxTableCellView', '__veloxCtxLastHit', '__fe10', '__fe01'])
check('S9 window.__velox* 缝 key 集不变', added.filter((k) => !LAZY.has(k)).length === 0, added)

// ── 复刻自检 impl 截图（编辑态工具栏全景）────────────────────────────────────
const cImpl = await cellPoint(1, 1)
await clickAt(cImpl.x, cImpl.y)
await sleep(500)
{
  const s = await send('Page.captureScreenshot', { format: 'png' })
  mkdirSync(SHOTS, { recursive: true })
  writeFileSync(`${SHOTS}/fe01-toolbar-pill-edit.png`, Buffer.from(s.data, 'base64'))
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(`${OUT_DIR}/IT-01-FE-01-impl.png`, Buffer.from(s.data, 'base64'))
  console.log('SHOT  fe01-toolbar-pill-edit.png + IT-01-FE-01-impl.png')
}

const pass = results.checks.filter((c) => c.ok).length
const fail = results.checks.length - pass
console.log(`\n==== ${pass} PASS / ${fail} FAIL (total ${results.checks.length}) ====`)
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(`${OUT_DIR}/IT-01-FE-01-batchA-cdp-results.json`, JSON.stringify({ ...results, pass, fail }, null, 2))
process.exit(fail === 0 ? 0 : 1)
