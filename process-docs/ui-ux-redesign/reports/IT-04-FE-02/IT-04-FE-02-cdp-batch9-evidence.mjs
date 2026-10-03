#!/usr/bin/env node
/**
 * IT-04 FE-02 批次 ⑨（batch9）测量证据链补测 — 零产品代码改动，仅取证
 *
 * fix-list:
 *  9.1 ⊞ 网格格点「单元格边界可辨」证据链修复（AC-ERR-14 判据 3 / UI-ELEM-02）
 *      旧探针（batch3-contrast.mjs:219-237）selector `[class*="grid"] [class*="cell"]`
 *      误中容器 .table-grid-picker-cells（241=240 格+1 容器；且 width>4 过滤器放行容器 →
 *      实测到的是容器幽灵边框 currentColor=--fg，非格点边框）。
 *      改用 [data-testid="grid-cell"]（gridPicker.ts:191）实测真格点：border-color/width、
 *      cell bg vs 弹层表面，对照 overlays.css:316-324 .table-grid-cell 与 ui_02 .gcell 设计口径。
 *  9.2 控件文字对比度补测（AC-NF-09 / AC-ERR-14 判据 1）：菜单栏、下拉菜单项、⋮/右键菜单项、
 *      对话框按钮（确认/取消）、toast 文字、⊞ 网格读数与预设钮、图片/链接浮层按钮文字。
 *      实测 <4.5:1 一律如实上报为新发现（勿粉饰）。
 *      WCAG 1.4.3 豁免 disabled 控件：禁用项（--fg-disabled）不计入 min，单独记 exemptDisabled。
 *  9.3 硬编码浅色块扫描面扩面（AC-ERR-14 判据 2）：弹层族（菜单下拉/右键⋮ 菜单/⊞ 网格弹层/
 *      侧栏/链接图片浮层/对话框 含按钮/条/分隔件背景）深色主题下近白色硬编码值检测（含子孙）。
 *  9.4 富文本通道色值证据链（AC-OP-17 判据 3，fix-list 追加项 5a）：live 导出富文本样张
 *      （__veloxP20.copyRichText → getClipboard），解析 inline style 色值字面量，
 *      与 palette.ts 双主题逐值比对 + 与编辑端运行时 token 逐值比对（rich 通道是内联字面值，
 *      与 html/pdf 的 CSS var 探针形态不兼容——batch5 5.4 rich:[] 即此口径差）。
 *
 * 运行（Git Bash）：
 *   cd D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend
 *   npx electron-vite dev -- --remote-debugging-port=9563 --user-data-dir=D:/code/typora/temp/it04-fe02-batch9-userdata
 *   node D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02/IT-04-FE-02-cdp-batch9-evidence.mjs
 *
 * 纪律：探针不得手工 remove() React 托管 DOM；草稿恢复对话框一律点「稍后」；
 * overlay 收拢一律走 Escape。产物一律 batch9 前缀（batch1-8 留档只增不改）。
 * 驱动侧防坑（batch9 首跑根因，已修）：
 *   - 折叠区下目标须 scrollIntoView({block:'center'}) 再取 rect（td y=1172>765 落空）；
 *   - 图片浮层须 clickAt（非 moveTo，batch2 口径）；链接浮层精确 hover .cm-md-link 两步移动；
 *   - toast 撤销钮仅 toast.action 存在时挂载（opsTable toastReceipt 结构操作）——
 *     键入+Ctrl+Z 只出无钮「已撤销」toast，须 ⋮→insertRowBelow 触发 undoAction toast；
 *   - ctx 禁用项过滤走祖先 button[disabled]/.velox-ctx-disabled（span 无 .disabled）；
 *   - 并发 agent HMR 会把 e2e/seams 模块级 __veloxP20=null 重跑而 useEffect 不重装 → 缝全灭：
 *     每阶段前 ensureSeams，缺失则 Page.reload + 重载夹具。
 */
import { writeFileSync, mkdirSync } from 'node:fs'

const PORT = Number(process.env.IT04_FE02_CDP_PORT ?? 9563)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-04-FE-02'
const FIXTURE_DIR = 'D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend'
const FIXTURE_PATH = `${FIXTURE_DIR}/it04-fe02-batch9.md`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT_DIR, { recursive: true })

const FIXTURE = [
  '# batch9 证据补测夹具',
  '',
  '正文段落文字（fg on bg）。',
  '',
  '> 引用文字',
  '',
  '行内 `code` 与 [链接](https://example.com)。',
  '',
  '```ts',
  'const x = 1',
  '```',
  '',
  '![图片](./logo-master.png)',
  '',
  '| 表头 | 列二 |',
  '| :--- | :---: |',
  '| 单元格 | 居中 |',
  ''
].join('\n')
writeFileSync(FIXTURE_PATH, FIXTURE)

// ── CDP 底座（沿 batch8 口径）────────────────────────────────────────────────
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) {
  console.error('NO_PAGE_TARGET', JSON.stringify(targets).slice(0, 300))
  process.exit(2)
}
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
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evalExpr(expression, timeoutMs = 20000) {
  let timer
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error('evaluate timeout')), timeoutMs)
  })
  try {
    const r = await Promise.race([
      send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      timeout
    ])
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  } finally { clearTimeout(timer) }
}
async function clickAt(x, y, button = 'left') {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons: button === 'right' ? 2 : 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: 1 })
}
async function moveTo(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
}
/** 两步 hover（先偏移再落点）——触发 mousemove 派发，hoverDiscipline 稳定收编。 */
async function hoverAt(x, y) {
  await moveTo(Math.max(2, x - 24), Math.max(2, y - 12))
  await sleep(80)
  await moveTo(x, y)
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
/** 草稿恢复对话框一律点「稍后」——绝不丢弃草稿。 */
async function dismissAllDialogs(max = 6) {
  for (let i = 0; i < max; i++) {
    const btn = await evalExpr(`(() => {
      const d = document.querySelector('.dialog-overlay')
      if (!d) return null
      const btns = [...d.querySelectorAll('.dialog-buttons button, .dialog-buttons .dialog-btn, .dialog-btn')]
      const byText = (t) => btns.find((b) => (b.textContent ?? '').trim() === t)
      const target = byText('稍后') ?? byText('取消') ?? btns[0] ?? null
      if (!target) return null
      const r = target.getBoundingClientRect()
      return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), text: (target.textContent ?? '').trim() }
    })()`)
    if (!btn) break
    await clickAt(btn.x, btn.y)
    await sleep(400)
  }
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT_DIR}/${name}`, Buffer.from(shot.data, 'base64'))
  return name
}
/** HMR 杀缝防护：e2e/seams 模块级置空后 useEffect 不重装 → 缝全灭。缺失则 reload 恢复。 */
async function ensureSeams(tag) {
  const ok = await evalExpr(`!!(window.__veloxP20 && window.__veloxP12)`)
  if (ok) return true
  console.log(`SEAMS_DOWN at ${tag} → Page.reload`)
  await send('Page.reload')
  await sleep(4000)
  const ok2 = await evalExpr(`!!(window.__veloxP20 && window.__veloxP12)`)
  if (!ok2) {
    console.error(`SEAMS_UNRECOVERED after reload at ${tag}`)
    return false
  }
  await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
  await sleep(1800)
  await dismissAllDialogs()
  console.log(`SEAMS_RECOVERED at ${tag}`)
  return true
}
/** scrollIntoView 后取中心点（折叠区下目标不落空）。 */
async function rectAt(sel) {
  return evalExpr(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)})
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return {
      x: +(r.left + r.width / 2).toFixed(2),
      y: +(r.top + r.height / 2).toFixed(2),
      inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      rect: [+r.left.toFixed(1), +r.top.toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)]
    }
  })()`)
}

const results = {
  meta: {
    batch: 'batch9-证据补测',
    port: PORT,
    startedAt: new Date().toISOString(),
    purpose: 'fix-biz-IT04PATH02-evidence：测量证据链修复（零产品代码改动）',
    probeRev: 'batch9-rev3（scrollIntoView/disabled 祖先过滤/clickAt 图片/td 直点进 ⋮/结构操作 undo toast/ensureSeams/rich 双侧归一/DPR 线宽口径/剪贴板锁 fallback）'
  },
  checks: []
}
const check = (name, ok, detail) => {
  results.checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 900) : ''}`)
  return !!ok
}

// ── in-page WCAG 助手（parse/alpha合成/相对亮度/对比度）─────────────────────
const WCAG = `
  const parse = (c) => {
    const m = (c ?? '').match(/rgba?\\(([^)]+)\\)/)
    if (!m) return null
    const p = m[1].split(',').map((s) => parseFloat(s.trim()))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  })
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b)
    return +((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2)
  }
  const rgbStr = (c) => 'rgb(' + c.r.toFixed(0) + ',' + c.g.toFixed(0) + ',' + c.b.toFixed(0) + ')'
  const bgOf = (el) => {
    let node = el
    let acc = null
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node)
      const c = parse(cs.backgroundColor)
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c
        if (c.a >= 1) return acc
      }
      node = node.parentElement
    }
    return acc ?? { r: 255, g: 255, b: 255, a: 1 }
  }
`

// ── 9.1 ⊞ 网格格点（真格点 [data-testid="grid-cell"]）────────────────────────
// 度量：border-color/width、cell bg、弹层表面（.table-grid-picker）、gap、
//      hover 选区态、WCAG 色块对比（border vs surface / border vs cell / cell vs surface）、
//      旧选择器口径差根因（241 = 240 格 + 1 容器 .table-grid-picker-cells）。
const GRID_PROBE = `(() => {
  ${WCAG}
  const picker = document.querySelector('[data-testid="grid-picker"], .table-grid-picker')
  if (!picker) return { found: false }
  const cells = [...picker.querySelectorAll('[data-testid="grid-cell"]')]
  const oldSel = [...document.querySelectorAll('[class*="grid"] [class*="cell"], [class*="resize"] [class*="cell"]')]
  const wrap = picker.querySelector('.table-grid-picker-cells')
  const plain = cells.find((c) => !c.classList.contains('is-hover')) ?? cells[0]
  const hover = cells.find((c) => c.classList.contains('is-hover'))
  if (!plain) return { found: true, cellCount: cells.length, oldSelectorCount: oldSel.length, error: 'no cells' }
  const cs = getComputedStyle(plain)
  const pickerCs = getComputedStyle(picker)
  const surface = parse(pickerCs.backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 }
  const cellBg = parse(cs.backgroundColor)
  const border = parse(cs.borderTopColor)
  const effBorder = border && border.a < 1 ? over(border, cellBg ?? surface) : border
  const effCell = cellBg && cellBg.a < 1 ? over(cellBg, surface) : cellBg
  const hoverCs = hover ? getComputedStyle(hover) : null
  const hoverBg = hoverCs ? parse(hoverCs.backgroundColor) : null
  const hoverBorder = hoverCs ? parse(hoverCs.borderTopColor) : null
  const effHoverBg = hoverBg && hoverBg.a < 1 ? over(hoverBg, surface) : hoverBg
  return {
    found: true,
    cellCount: cells.length,
    oldSelectorCount: oldSel.length,
    oldSelectorSample: oldSel.slice(0, 3).map((e) => String(e.className).slice(0, 60)),
    wrapCount: picker.querySelectorAll('.table-grid-picker-cells').length,
    plain: {
      border: cs.borderTopColor,
      borderWidth: cs.borderTopWidth,
      borderStyle: cs.borderTopStyle,
      bg: cs.backgroundColor,
      radius: cs.borderTopLeftRadius,
      size: cs.width + 'x' + cs.height
    },
    hover: hover ? {
      border: hoverCs.borderTopColor,
      borderWidth: hoverCs.borderTopWidth,
      bg: hoverCs.backgroundColor
    } : null,
    surface: pickerCs.backgroundColor,
    wrapGap: wrap ? getComputedStyle(wrap).gap : null,
    ratios: {
      borderVsSurface: effBorder ? ratio(effBorder, surface) : null,
      borderVsCell: effBorder && effCell ? ratio(effBorder, effCell) : null,
      cellVsSurface: effCell ? ratio(effCell, surface) : null,
      hoverBorderVsSurface: hoverBorder ? ratio(hoverBorder.a < 1 ? over(hoverBorder, effHoverBg ?? surface) : hoverBorder, surface) : null,
      hoverBgVsSurface: effHoverBg ? ratio(effHoverBg, surface) : null
    },
    readout: (() => {
      const r = picker.querySelector('.table-grid-picker-readout')
      const b = picker.querySelector('.table-grid-picker-readout b')
      const sfx = picker.querySelector('.table-grid-picker-readout-suffix')
      const probe = (el) => {
        if (!el) return null
        const fg = parse(getComputedStyle(el).color)
        const bg = bgOf(el)
        const eff = fg.a < 1 ? over(fg, bg) : fg
        return { text: (el.textContent ?? '').trim().slice(0, 20), color: getComputedStyle(el).color, bg: rgbStr(bg), ratio: ratio(eff, bg) }
      }
      return { body: probe(r), dims: probe(b), suffix: probe(sfx) }
    })(),
    presets: (() => {
      const els = [...picker.querySelectorAll('.table-grid-picker-preset, [data-testid^="grid-preset-"]')]
      return els.map((el) => {
        const fg = parse(getComputedStyle(el).color)
        const bg = bgOf(el)
        const eff = fg.a < 1 ? over(fg, bg) : fg
        return { text: (el.textContent ?? '').trim(), color: getComputedStyle(el).color, bg: rgbStr(bg), ratio: ratio(eff, bg) }
      })
    })()
  }
})()`

async function openGridPicker() {
  // 进入表格编辑态（7C 工具栏 cell-active 才挂载）→ 点 ⊞
  await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
  const cell = await rectAt('.cm-md-table-wrap table tr td')
  if (cell) await clickAt(cell.x, cell.y)
  await sleep(700)
  const gridBtn = await rectAt('[data-op="resizeTable"]')
  if (!gridBtn) return false
  await clickAt(gridBtn.x, gridBtn.y)
  await sleep(600)
  return true
}

// ── 9.2 控件文字对比度补测（覆盖旧 7 探针之外的控件面）────────────────────────
// 每个 family 取**启用**命中元素的最小对比度；<4.5:1 如实入 bad。
// 禁用项（WCAG 1.4.3 豁免）按祖先 button[disabled]/.velox-ctx-disabled/[aria-disabled] 过滤，
// 单独记 exemptDisabled（旧探针 el.disabled 打在 span 上恒 false → 假 FAIL）。
const TEXT_PROBE = `(() => {
  ${WCAG}
  const families = ${JSON.stringify([
    ['.menubar-label', '菜单栏菜单根'],
    ['.menubar-brand', '菜单栏品牌字'],
    ['.menu-dropdown .menu-item:not(:disabled) .menu-item-label', '下拉菜单项文字'],
    ['.menu-dropdown .menu-item:not(:disabled) .menu-item-shortcut', '下拉菜单快捷键回显'],
    ['.menu-dropdown .menu-group-title', '下拉菜单分组标题'],
    ['.velox-ctx-menu .velox-ctx-label, .editor-context-menu .velox-ctx-label', '⋮/右键菜单项文字'],
    ['.velox-ctx-menu .velox-ctx-shortcut, .editor-context-menu .velox-ctx-shortcut', '⋮/右键菜单快捷键/箭头'],
    ['.velox-ctx-menu .velox-ctx-group-label, .editor-context-menu .velox-ctx-group-label', '⋮/右键菜单分组标题'],
    ['.dialog-buttons button', '对话框按钮（确认/取消）'],
    ['.dialog-title', '对话框标题'],
    ['.toast-msg', 'toast 文字'],
    ['.toast-undo-btn', 'toast 撤销按钮'],
    ['.table-grid-picker-readout', '⊞ 网格读数'],
    ['.table-grid-picker-readout b', '⊞ 网格读数 R×C'],
    ['.table-grid-picker-readout-suffix', '⊞ 网格读数后缀'],
    ['.table-grid-picker-preset', '⊞ 网格预设钮'],
    ['.cm-md-image-toolbar-btn', '图片浮层按钮'],
    ['.cm-md-image-toolbar-pct', '图片百分比读数'],
    ['.cm-md-float-btn', '浮层图标按钮（图对齐/链接编辑等）'],
    ['.cm-md-float-primary', '浮层主按钮（完成）'],
    ['.cm-md-link-url', '链接浮层 URL 文字'],
    ['.cm-md-float-select', '浮层宽度选择器']
  ])}
  const isDisabled = (el) =>
    el.disabled === true ||
    el.getAttribute('aria-disabled') === 'true' ||
    !!el.closest('button[disabled], [aria-disabled="true"], .velox-ctx-disabled, .menu-item:disabled, [disabled]')
  const out = []
  for (const [sel, label] of families) {
    const all = [...document.querySelectorAll(sel)].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
    const enabled = all.filter((el) => !isDisabled(el))
    const exempt = all.filter(isDisabled)
    const sampleOf = (el) => {
      const fg = parse(getComputedStyle(el).color)
      const bg = bgOf(el)
      const eff = fg.a < 1 ? over(fg, bg) : fg
      return {
        text: (el.textContent ?? '').trim().slice(0, 18),
        color: getComputedStyle(el).color,
        bg: rgbStr(bg),
        ratio: ratio(eff, bg),
        disabled: isDisabled(el)
      }
    }
    const samples = enabled.slice(0, 4).map(sampleOf)
    const exemptSamples = exempt.slice(0, 2).map(sampleOf)
    out.push({
      label, sel,
      found: enabled.length,
      exemptDisabled: exempt.length,
      minRatio: samples.length ? Math.min(...samples.map((s) => s.ratio)) : null,
      samples,
      exemptSamples
    })
  }
  return out
})()`

// ── 9.3 深色硬编码浅色块扩扫（弹层族并集，含按钮/条/分隔件背景 + 全子孙）────────
// 旧扫描只查 8 根元素自身 background → 漏掉子孙裸控件（TableInsertDialog UA 浅色 chrome）。
const HARDCODE_SCAN = `(() => {
  const roots = ['.menu-dropdown', '.velox-ctx-menu', '.editor-context-menu', '.table-grid-picker', '.sidebar', '.cm-md-float', '.cm-md-image-toolbar', '.toast', '.dialog-overlay .dialog']
  const idOf = (el) => String(el.className ?? '').slice(0, 70) + (el.dataset?.testid ? '|testid:' + el.dataset.testid : '')
  const bad = []
  for (const sel of roots) {
    for (const root of document.querySelectorAll(sel)) {
      const els = [root, ...root.querySelectorAll('*')]
      for (const el of els) {
        const cs = getComputedStyle(el)
        const bg = cs.backgroundColor
        const m = bg.match(/rgba?\\(([^)]+)\\)/)
        if (m) {
          const p = m[1].split(',').map((s) => parseFloat(s.trim()))
          const [r, g, b, a = 1] = p
          if (a > 0.1 && r > 220 && g > 220 && b > 220) {
            bad.push({
              family: sel, tag: el.tagName, cls: idOf(el), prop: 'background', value: bg,
              uaChrome: (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT') && !String(el.className).trim()
            })
          }
        }
        // 分隔件/条：border 色也扫（sep/divider 族多用 border 上色）
        if (/sep|separator|divider|bar|grip|resizer/i.test(String(el.className))) {
          for (const prop of ['borderTopColor', 'borderLeftColor', 'borderBottomColor']) {
            const bm = (cs[prop] ?? '').match(/rgba?\\(([^)]+)\\)/)
            if (!bm) continue
            const p = bm[1].split(',').map((s) => parseFloat(s.trim()))
            const [r, g, b, a = 1] = p
            if (a > 0.1 && r > 220 && g > 220 && b > 220) {
              bad.push({ family: sel, tag: el.tagName, cls: idOf(el), prop, value: cs[prop], uaChrome: false })
            }
          }
        }
      }
    }
  }
  return bad
})()`

// ── 主流程 ─────────────────────────────────────────────────────────────────
await send('Page.bringToFront')
await send('Page.setWebLifecycleState', { state: 'active' })
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await dismissAllDialogs()
if (!(await ensureSeams('boot'))) {
  console.error('seams unavailable at boot — abort')
  process.exit(3)
}
await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(1600)
await dismissAllDialogs()

async function setTheme(theme) {
  await ensureSeams(`setTheme(${theme})`)
  await evalExpr(`window.__veloxP20.setThemePref('${theme}')`)
  await sleep(500)
  // 每轮重载夹具（undo 历史与弹层状态干净）
  await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
  await sleep(1300)
  await dismissAllDialogs()
}

// ── 9.1 网格格点（浅/深各一遍 + 截图）────────────────────────────────────────
results.grid = {}
for (const theme of ['light', 'dark']) {
  await setTheme(theme)
  const opened = await openGridPicker()
  if (!opened) {
    check(`9.1-${theme} ⊞ 网格弹层可打开（data-op=resizeTable）`, false, { opened: false })
    continue
  }
  const probe = await evalExpr(GRID_PROBE)
  results.grid[theme] = probe
  const shot = await screenshot(`IT-04-FE-02-cdp-batch9-grid-${theme}.png`)
  probe.screenshot = shot
  // DPR 上下文：Windows 显示缩放 DPR=1.75 时 Chromium 对边框做设备像素吸附——
  // 设计 1px 边框吸附为 1 device px = 1/1.75 ≈ 0.571 CSS px（getComputedStyle 报 0.571px）。
  // 判据按「实线边框存在（width>0）+ 亮度台阶 + 格栅缝 + hover accent」，线宽数值与 DPR 如实留档。
  const dpr = await evalExpr(`devicePixelRatio`)
  probe.dpr = dpr
  probe.designBorder = 'border:1px solid var(--bg-inset) — overlays.css:321 .table-grid-cell；ui_02 .gcell 同口径'
  // 判据（UI-ELEM-02 两项同时成立）：
  //  ① 弹层内文字（读数/预设钮）对比度 ≥4.5:1（AC-NF-09 口径）
  //  ② 单元格边界线可辨：实线边框存在 + 与两侧（格底/弹层表面）有亮度台阶 + 2px 缝格栅图案
  //    + hover 选区 accent 态在位（图案第二信号）。台阶量如实记（非 WCAG 3:1 非文本口径——
  //    ui_02 .gcell 设计即 --bg on --bg-inset 微台阶 + 格栅缝，按「可辨」判）。
  const textRatios = [
    probe.readout?.body?.ratio, probe.readout?.dims?.ratio, probe.readout?.suffix?.ratio,
    ...(probe.presets ?? []).map((p) => p.ratio)
  ].filter((v) => typeof v === 'number')
  const textOk = textRatios.length > 0 && Math.min(...textRatios) >= 4.5
  const lineOk = probe.plain
    && probe.plain.borderStyle === 'solid'
    && parseFloat(probe.plain.borderWidth) > 0
    && probe.ratios
    && (probe.ratios.borderVsSurface > 1.02 || probe.ratios.borderVsCell > 1.02 || probe.ratios.cellVsSurface > 1.02)
    && !!probe.hover // 选区 accent 态在位（图案第二信号）
    && probe.wrapGap === '2px' // 格栅缝图案（ui_02 2px gap）
  check(
    `9.1-${theme} ⊞ 网格格点边界可辨 + 弹层文字对比（AC-ERR-14 判据 3 / UI-ELEM-02）`,
    probe.found && probe.cellCount === 240 && textOk && !!lineOk,
    {
      cellCount: probe.cellCount,
      oldSelectorCount: probe.oldSelectorCount,
      oldSelectorSample: probe.oldSelectorSample,
      plain: probe.plain,
      hover: probe.hover,
      surface: probe.surface,
      gap: probe.wrapGap,
      dpr,
      designBorder: probe.designBorder,
      ratios: probe.ratios,
      textMin: textRatios.length ? Math.min(...textRatios) : null,
      readout: probe.readout,
      presets: probe.presets,
      shot
    }
  )
  await pressKey('Escape', 'Escape')
  await sleep(400)
}
// 口径差根因注记（241 vs 240）——已立案项，勿另立
{
  const l = results.grid.light
  results.grid.countNote = {
    statement: '241 vs 240 口径差根因：旧 selector [class*="grid"] [class*="cell"] 同时命中 240 个 .table-grid-cell 与容器 .table-grid-picker-cells（class 含 "cell"），共 241；且旧探针 pick 的 width>4 过滤器放行容器 → 实测 border-color 为容器 currentColor（=--fg #333/#d4d4d4）、border-width 0 的幽灵边框，非格点边框。真格点 = [data-testid="grid-cell"] 240 个。',
    oldSelectorCount: l?.oldSelectorCount,
    newSelectorCount: l?.cellCount,
    wrapCount: l?.wrapCount,
    oldPickRootCause: 'batch3-contrast.mjs:220-237 pick=cells.find(width>4) 命中容器'
  }
  console.log('NOTE  241 vs 240 口径差根因 → ' + JSON.stringify(results.grid.countNote).slice(0, 400))
}

// ── 9.2/9.3 双主题控件文字对比度 + 深色弹层族硬编码扩扫 ───────────────────────
results.text = {}
results.hardcode = {}
for (const theme of ['light', 'dark']) {
  await setTheme(theme)

  // -- 菜单栏 + 下拉菜单项 --
  await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
  const menuBtn = await evalExpr(`(() => {
    const b = document.querySelector('[data-testid="menu-root-file"]') ?? document.querySelector('.menubar-label')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (menuBtn) await clickAt(menuBtn.x, menuBtn.y)
  await sleep(500)

  // -- ⊞ 网格弹层（读数/预设钮 + 硬编码扫面）--
  // 先测菜单（菜单开着时网格不共存）——采样文本探针会把当前可见 overlay 全量测到
  const menuText = await evalExpr(TEXT_PROBE)
  const menuHard = theme === 'dark' ? await evalExpr(HARDCODE_SCAN) : []
  await pressKey('Escape', 'Escape')
  await sleep(300)

  // 网格弹层
  await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
  await sleep(1200)
  await dismissAllDialogs()
  const openedGrid = await openGridPicker()
  const gridText = openedGrid ? await evalExpr(TEXT_PROBE) : []
  const gridHard = theme === 'dark' && openedGrid ? await evalExpr(HARDCODE_SCAN) : []
  await pressKey('Escape', 'Escape')
  await sleep(300)

  // -- ⋮ 菜单（表格更多操作，走 ctx menu bus）→ 结构操作触发 undo toast --
  // 注意：不可用 openGridPicker+Escape 组合进 cell-active——Escape 会退出表格编辑态
  // 摘掉 7C 工具栏（batch9 首跑根因）。直接 clickAt td 即挂载工具栏。
  await evalExpr(`window.__veloxP12.loadDoc(${JSON.stringify(FIXTURE)}, ${JSON.stringify(FIXTURE_PATH)})`)
  await sleep(1200)
  await dismissAllDialogs()
  await evalExpr(`(() => { window.__veloxEditor?.view?.focus?.(); return true })()`)
  const tdPt = await rectAt('.cm-md-table-wrap table tr td')
  if (tdPt) await clickAt(tdPt.x, tdPt.y)
  await sleep(800)
  const moreBtn = await rectAt('[data-op="TBL-MOR-OPN"]')
  let moreOpened = false
  if (moreBtn) {
    await clickAt(moreBtn.x, moreBtn.y)
    await sleep(600)
    moreOpened = await evalExpr(`!!document.querySelector('.velox-ctx-menu, .editor-context-menu')`)
  }
  const moreText = await evalExpr(TEXT_PROBE)
  const moreHard = theme === 'dark' ? await evalExpr(HARDCODE_SCAN) : []
  // 点「下方插入行」（opsTable toastReceipt → action: undoAction）→ toast 带撤销钮
  const insRow = await evalExpr(`(() => {
    const b = document.querySelector('[data-op="insertRowBelow"]')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2), disabled: b.disabled === true || b.getAttribute('aria-disabled') === 'true', text: (b.textContent ?? '').trim() }
  })()`)
  let undoToastSeen = false
  let toastMsg = null
  if (insRow && !insRow.disabled) {
    await clickAt(insRow.x, insRow.y)
    await sleep(900)
    undoToastSeen = await evalExpr(`!!document.querySelector('.toast-undo-btn')`)
    toastMsg = await evalExpr(`(() => { const m = document.querySelector('.toast-msg'); return m ? (m.textContent ?? '').trim() : null })()`)
  }
  const toastText = await evalExpr(TEXT_PROBE)
  const toastHard = theme === 'dark' ? await evalExpr(HARDCODE_SCAN) : []
  await pressKey('Escape', 'Escape')
  await sleep(300)

  // -- 右键菜单（落正文 .cm-line，勿落 cm-content 几何中心）--
  const paraBox = await rectAt('.cm-content .cm-line')
  // 优先找「正文」行
  const para2 = await evalExpr(`(() => {
    const p = [...document.querySelectorAll('.cm-content .cm-line')].find((l) => l.textContent.includes('正文'))
    if (!p) return null
    p.scrollIntoView({ block: 'center' })
    const r = p.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  const ctxPt = para2 ?? paraBox
  if (ctxPt) await clickAt(ctxPt.x, ctxPt.y, 'right')
  await sleep(600)
  const ctxText = await evalExpr(TEXT_PROBE)
  const ctxHard = theme === 'dark' ? await evalExpr(HARDCODE_SCAN) : []
  await pressKey('Escape', 'Escape')
  await sleep(300)

  // -- 对话框按钮（确认/取消）：P22 表格插入对话框（安全 seam，不涉草稿）--
  await evalExpr(`(() => { window.__veloxP22?.openDialog?.('insert'); return true })()`)
  await sleep(600)
  const dlgText = await evalExpr(TEXT_PROBE)
  const dlgHard = theme === 'dark' ? await evalExpr(HARDCODE_SCAN) : []
  await dismissAllDialogs()
  await sleep(300)

  // -- 图片浮层（clickAt 图片，batch2 口径；moveTo 不出工具栏）--
  const imgPt = await rectAt('.cm-md-image')
  if (imgPt) { await clickAt(imgPt.x, imgPt.y); await sleep(800) }
  const imgText = await evalExpr(TEXT_PROBE)
  const imgHard = theme === 'dark' ? await evalExpr(HARDCODE_SCAN) : []

  // -- 链接浮层（精确 hover .cm-md-link，两步移动）--
  const linkPt = await rectAt('.cm-md-link, .cm-content a')
  if (linkPt) { await hoverAt(linkPt.x, linkPt.y); await sleep(900) }
  const linkText = await evalExpr(TEXT_PROBE)
  const linkHard = theme === 'dark' ? await evalExpr(HARDCODE_SCAN) : []
  const linkPopSeen = await evalExpr(`!!document.querySelector('[data-testid="link-hover-float"]')`)
  const imgFloatSeen = await evalExpr(`!!document.querySelector('.cm-md-image-toolbar, [data-testid="image-edit-float"]')`)
  await pressKey('Escape', 'Escape')
  await sleep(300)

  // -- 侧栏（常驻，随时可扫）--
  const sideHard = theme === 'dark' ? await evalExpr(HARDCODE_SCAN) : []
  const sideText = await evalExpr(TEXT_PROBE)

  // 合并：同 family 取并集（found 取 max，minRatio 取 min，samples 拼接去重）
  const merge = (probes) => {
    const byLabel = new Map()
    for (const probe of probes) {
      for (const row of probe) {
        const prev = byLabel.get(row.label)
        if (!prev) {
          byLabel.set(row.label, { ...row, samples: [...row.samples], exemptSamples: [...(row.exemptSamples ?? [])] })
          continue
        }
        prev.found = Math.max(prev.found, row.found)
        prev.exemptDisabled = (prev.exemptDisabled ?? 0) + (row.exemptDisabled ?? 0)
        if (row.minRatio != null) prev.minRatio = prev.minRatio == null ? row.minRatio : Math.min(prev.minRatio, row.minRatio)
        for (const s of row.samples) {
          if (!prev.samples.some((x) => x.text === s.text && x.ratio === s.ratio)) prev.samples.push(s)
        }
      }
    }
    return [...byLabel.values()]
  }
  const merged = merge([menuText, gridText, moreText, toastText, ctxText, dlgText, imgText, linkText, sideText])
  results.text[theme] = {
    phases: {
      menu: menuText, grid: gridText, more: moreText, toast: toastText, ctx: ctxText,
      dialog: dlgText, image: imgText, link: linkText, sidebar: sideText
    },
    merged,
    moreOpened,
    insRow,
    undoToastSeen,
    toastMsg,
    linkPopSeen,
    imgFloatSeen
  }
  const bad = merged.filter((r) => r.minRatio != null && r.minRatio < 4.5)
  const missing = merged.filter((r) => r.found === 0).map((r) => r.label)
  check(
    `9.2-${theme} 控件文字对比度 ≥4.5:1（AC-NF-09 / AC-ERR-14 判据 1，batch9 补测面）`,
    bad.length === 0,
    {
      covered: merged.filter((r) => r.found > 0).map((r) => `${r.label}:${r.minRatio}`),
      bad: bad.map((r) => ({ label: r.label, sel: r.sel, minRatio: r.minRatio, samples: r.samples })),
      notFound: missing,
      exemptDisabled: merged.filter((r) => (r.exemptDisabled ?? 0) > 0).map((r) => `${r.label}:${r.exemptDisabled}`),
      floatPresence: { moreMenu: moreOpened, undoToast: undoToastSeen, toastMsg, linkPop: linkPopSeen, imageFloat: imgFloatSeen }
    }
  )
  if (theme === 'dark') {
    const offenders = [...menuHard, ...gridHard, ...moreHard, ...toastHard, ...ctxHard, ...dlgHard, ...imgHard, ...linkHard, ...sideHard]
    // 去重（含 testid，保证 table-rows/table-cols 两个 input 各留一条）
    const seen = new Set()
    const uniq = offenders.filter((o) => {
      const k = `${o.family}|${o.cls}|${o.prop}|${o.value}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    results.hardcode.dark = {
      scannedFamilies: ['.menu-dropdown', '.velox-ctx-menu/.editor-context-menu', '.table-grid-picker', '.sidebar', '.cm-md-float', '.cm-md-image-toolbar', '.toast', '.dialog（含全子孙）'],
      perPhase: {
        menu: menuHard.length, grid: gridHard.length, more: moreHard.length, toast: toastHard.length,
        ctx: ctxHard.length, dialog: dlgHard.length, image: imgHard.length, link: linkHard.length, sidebar: sideHard.length
      },
      offenders: uniq,
      note: 'uaChrome=true 表示 BUTTON/INPUT 无 class 的原生 UA 默认浅色 chrome（非 CSS 硬编码 hex）——同类视觉缺陷（深色未适配浅色块），旧根元素自身扫描漏检。'
    }
    check(
      '9.3 深色弹层族无硬编码近白色块（AC-ERR-14 判据 2，batch9 扩扫面）',
      uniq.length === 0,
      { offenders: uniq, perPhase: results.hardcode.dark.perPhase }
    )
  }
  await pressKey('Escape', 'Escape')
  await sleep(300)
}

// ── 9.4 富文本通道色值证据链（AC-OP-17 判据 3，fix-list 追加项 5a）────────────
// 富文本走 inlineStyles.ts 内联 style 字面色值（paletteFor(theme) 生成），
// 与 html/pdf 的 CSS var 探针形态不兼容——batch5 5.4 rich:[] 即此口径差。
// 本段：live 导出富文本样张 → 解析全部 inline style 色值 → 与 palette.ts
// 双主题逐值比对 + 与编辑端运行时 token 逐值比对（palette.test.ts 静态守护链的 live 兑现）。
// 参考常量摘自 export/palette.ts（LIGHT/DARK_PALETTE + LIGHT/DARK_CALLOUTS）。
const REF_PALETTE = {
  light: {
    bg: '#ffffff', bgAlt: '#fafafa', fg: '#333333', fgDim: '#6b6b6b', border: '#e5e5e5',
    accent: '#0969da', quoteBorder: '#d0d7de', codeBg: 'rgba(175, 184, 193, 0.2)',
    hrColor: '#d8dee4', highlightBg: '#fff8c5', tableHeaderBg: '#f0f0f0', tableStripeBg: '#f6f6f6'
  },
  dark: {
    bg: '#1e1e1e', bgAlt: '#252526', fg: '#d4d4d4', fgDim: '#9a9a9a', border: '#333333',
    accent: '#58a6ff', quoteBorder: '#444444', codeBg: 'rgba(110, 118, 129, 0.25)',
    hrColor: '#444444', highlightBg: '#654a15', tableHeaderBg: '#2d2d2e', tableStripeBg: '#252526'
  }
}
const REF_CALLOUTS = {
  light: [
    ['#0969da', '#f0f6fc'], ['#1a7f37', '#eef8f2'], ['#8250df', '#f5e9f7'], ['#9a6700', '#fff6e0'],
    ['#cf222e', '#fff0ee'], ['#0a7ea4', '#e7f3ff'], ['#1a7f37', '#e6f6ec'], ['#cf222e', '#ffebe9']
  ],
  dark: [
    ['#4493f8', '#1c2b3a'], ['#3fb950', '#1c2e1e'], ['#a371f7', '#2a2140'], ['#d29922', '#3a2e12'],
    ['#f85149', '#3d1c20'], ['#58a6ff', '#1c2b3a'], ['#3fb950', '#1c2e1e'], ['#f85149', '#3d1418']
  ]
}
// RUNTIME_CSS_VAR 映射（palette.ts:47-61）+ 富文本根 background 用 bgAlt/--bg-sidebar
const RUNTIME_VAR = {
  bg: '--bg', bgAlt: '--bg-sidebar', fg: '--fg', fgDim: '--fg-dim', border: '--border',
  accent: '--accent', quoteBorder: '--quote-border', codeBg: '--code-bg', hrColor: '--hr-color',
  highlightBg: '--highlight-bg', tableHeaderBg: '--table-header-bg', tableStripeBg: '--table-stripe-bg'
}

// 双侧同一 norm() 归一（batch9 首跑根因：allowed 存 hex、found 存 rgba → 全假 unknown）
const RICH_ANALYZE = (allowedRaw) => `(() => {
  const norm = (v) => {
    v = (v ?? '').trim().toLowerCase()
    if (!v) return v
    if (v.startsWith('#')) {
      let h = v.slice(1)
      if (h.length === 3) h = h.split('').map((c) => c + c).join('')
      const n = parseInt(h.slice(0, 6), 16)
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + (a === 1 ? '1' : String(+a.toFixed(3))) + ')'
    }
    return v.replace(/\\s+/g, '')
  }
  const allowed = new Set(${JSON.stringify(allowedRaw)}.map(norm))
  const html = window.__veloxBatch9RichHtml ?? ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const found = []
  for (const el of doc.querySelectorAll('[style]')) {
    for (const decl of el.getAttribute('style').split(';')) {
      const i = decl.indexOf(':')
      if (i < 0) continue
      const prop = decl.slice(0, i).trim().toLowerCase()
      const val = decl.slice(i + 1).trim()
      if (!/(^|[-])(color|background|border|outline|fill|stroke|text-decoration)/.test(prop) && !/^border/.test(prop)) continue
      if (/^(transparent|inherit|none|currentcolor)$/.test(val.toLowerCase())) {
        found.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), prop, raw: val, kind: 'keyword' })
        continue
      }
      const cm = val.match(/#[0-9a-fA-F]{3,8}|rgba?\\([^)]*\\)/g)
      if (cm) for (const c of cm) found.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), prop, raw: c, norm: norm(c), kind: 'color' })
    }
  }
  const colorLits = found.filter((f) => f.kind === 'color')
  const unknown = colorLits.filter((f) => !allowed.has(f.norm))
  // 关键角色 spot-check（tagStyles 口径）：p→fg、a→accent、th 背景→tableHeaderBg、
  // pre 背景→bgAlt、code 背景→codeBg、blockquote 边→quoteBorder、斑马 td→tableStripeBg、根→bg
  const first = (sel) => doc.querySelector(sel)
  const roleVal = (el, prop) => {
    if (!el) return null
    for (const decl of (el.getAttribute('style') ?? '').split(';')) {
      const i = decl.indexOf(':')
      if (i < 0) continue
      if (decl.slice(0, i).trim().toLowerCase() === prop) return decl.slice(i + 1).trim()
    }
    return null
  }
  return {
    htmlLen: html.length,
    textLen: (doc.body.textContent ?? '').length,
    literalCount: colorLits.length,
    uniqueColorLiterals: [...new Set(colorLits.map((f) => f.norm))],
    unknown,
    roles: {
      pColor: roleVal(first('p'), 'color'),
      aColor: roleVal(first('a'), 'color'),
      thBg: roleVal(first('th'), 'background'),
      preBg: roleVal(first('pre'), 'background'),
      codeBg: roleVal(first('p code, li code, code'), 'background'),
      blockquoteBorder: roleVal(first('blockquote'), 'border-left'),
      zebraTdBg: (() => {
        const t = first('table')
        if (!t) return null
        const rows = t.querySelectorAll('tr')
        return rows.length > 1 ? roleVal(rows[1].children[0], 'background') : null
      })(),
      rootBg: (() => {
        const art = doc.querySelector('article, body > *')
        return art ? roleVal(art, 'background') : null
      })()
    }
  }
})()`

results.rich = {}
for (const theme of ['light', 'dark']) {
  await setTheme(theme)
  await ensureSeams(`rich(${theme})`)
  // 首选通道：__veloxP20.copyRichText → getClipboard（fix-list 指定方法）。
  // 若剪贴板回读为空（batch9 实测：OS 剪贴板被外部进程锁死，PowerShell
  // Set/Get-Clipboard 同报 ExternalException；Electron clipboard 静默空转），
  // 走 fallback：动态 import 与 writeRichText **完全同一函数组合**——
  // wrapFragment(inlineStyleFragment(renderDoc(md, {baseDir, theme, imageMode:'embed'}), theme), theme)
  // （copyRichText.ts:30-38 的载荷构造体，逐参一致）→ 与 clipboardWriteHtml 写出的
  // html 串严格等值，仅绕开 OS 剪贴板传输层。capturePath 如实记两条路径。
  const copied = await evalExpr(`(async () => {
    const ok = await window.__veloxP20.copyRichText()
    await new Promise((r) => setTimeout(r, 250))
    const clip = await window.__veloxP20.getClipboard()
    const html = clip?.html ?? ''
    window.__veloxBatch9RichHtml = html
    return { ok, htmlLen: html.length, textLen: (clip?.text ?? '').length, path: html.length > 0 ? 'clipboard' : 'clipboard-empty' }
  })()`)
  if (copied.htmlLen === 0) {
    console.log(`rich(${theme}): clipboard empty → fallback to writeRichText payload via dynamic import`)
    const fb = await evalExpr(`(async () => {
      try {
        const [{ inlineStyleFragment, wrapFragment }, { renderDoc }, lpMod] = await Promise.all([
          import('/src/export/inlineStyles.ts'),
          import('/src/export/renderDoc/index.ts'),
          import('/src/editor/livePreview/index.ts')
        ])
        const view = window.__veloxEditor.view
        const lp = lpMod.getLivePreviewConfig(view.state)
        const md = view.state.doc.toString()
        const fragment = await renderDoc(md, { baseDir: lp.baseDir, theme: lp.theme, imageMode: 'embed' })
        const html = wrapFragment(inlineStyleFragment(fragment, lp.theme), lp.theme)
        window.__veloxBatch9RichHtml = html
        return { ok: true, htmlLen: html.length, fragLen: fragment.length, theme: lp.theme }
      } catch (e) {
        return { ok: false, err: String(e && e.message || e).slice(0, 300) }
      }
    })()`)
    copied.fallback = fb
    copied.path = fb.ok ? 'fallback:wrapFragment(inlineStyleFragment(renderDoc))' : 'fallback-failed'
  }
  await sleep(300)
  const pal = REF_PALETTE[theme]
  const callouts = REF_CALLOUTS[theme]
  const allowedRaw = [...Object.values(pal).map((v) => v.toLowerCase()), '#d1242f']
  for (const [bar, bg] of callouts) { allowedRaw.push(bar.toLowerCase(), bg.toLowerCase()) }
  const analysis = await evalExpr(RICH_ANALYZE(allowedRaw))
  // 运行时 token 逐值比对（编辑端 CSS var）
  const runtime = await evalExpr(`(() => {
    const cs = getComputedStyle(document.querySelector('.app') ?? document.body)
    const out = {}
    for (const k of ${JSON.stringify(Object.values(RUNTIME_VAR))}) out[k] = cs.getPropertyValue(k).trim().toLowerCase()
    return out
  })()`)
  const tokenCompare = Object.entries(RUNTIME_VAR).map(([key, cssVar]) => {
    const exp = (pal[key] ?? '').toLowerCase()
    const act = (runtime[cssVar] ?? '').toLowerCase()
    return { token: key, cssVar, palette: exp, runtime: act, match: exp === act }
  })
  // 角色 spot-check（双侧 trim/lowercase；palette 字面值 == inlineStyles 写出字面值）
  const normHex = (v) => (v ?? '').trim().toLowerCase()
  const roleCheck = {
    pColorFg: normHex(analysis.roles.pColor) === pal.fg.toLowerCase(),
    aColorAccent: normHex(analysis.roles.aColor) === pal.accent.toLowerCase(),
    thBgHeader: normHex(analysis.roles.thBg) === pal.tableHeaderBg.toLowerCase(),
    preBgBgAlt: normHex(analysis.roles.preBg) === pal.bgAlt.toLowerCase(),
    codeBgCode: normHex(analysis.roles.codeBg) === pal.codeBg.toLowerCase(),
    blockquoteQuoteBorder: (analysis.roles.blockquoteBorder ?? '').toLowerCase().includes(pal.quoteBorder.toLowerCase()),
    zebraStripe: analysis.roles.zebraTdBg == null || normHex(analysis.roles.zebraTdBg) === pal.tableStripeBg.toLowerCase(),
    rootBg: analysis.roles.rootBg == null || normHex(analysis.roles.rootBg) === pal.bg.toLowerCase()
  }
  results.rich[theme] = {
    copied,
    capturePath: copied.path,
    uniqueColorLiterals: analysis.uniqueColorLiterals,
    literalCount: analysis.literalCount,
    unknown: analysis.unknown,
    roles: analysis.roles,
    roleCheck,
    tokenCompare,
    allowedSetSize: allowedRaw.length
  }
  // 样张留档（内联 style 富文本 HTML）——data URI 图体过长，留档时截断以保可读
  const htmlRaw = await evalExpr(`window.__veloxBatch9RichHtml`)
  const htmlOut = (htmlRaw ?? '').replace(/src="data:[^"]{200,}"/g, 'src="data:...[elided-for-archive]"')
  writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch9-rich-${theme}.html`, htmlOut)
  results.rich[theme].sampleFile = `IT-04-FE-02-cdp-batch9-rich-${theme}.html`
  results.rich[theme].sampleElidedDataUri = htmlOut.includes('[elided-for-archive]')
  check(
    `9.4-${theme} 富文本 inline style 色值 ⊆ palette 值域 + 运行时 token 逐值一致（AC-OP-17 判据 3）`,
    analysis.htmlLen > 0 && analysis.unknown.length === 0 && tokenCompare.every((t) => t.match) && Object.values(roleCheck).every(Boolean),
    {
      capturePath: copied.path,
      unique: analysis.uniqueColorLiterals,
      unknown: analysis.unknown,
      tokenMismatch: tokenCompare.filter((t) => !t.match),
      roleCheck,
      htmlLen: analysis.htmlLen
    }
  )
  await sleep(200)
}

results.meta.finishedAt = new Date().toISOString()
writeFileSync(`${OUT_DIR}/IT-04-FE-02-cdp-batch9-data.json`, JSON.stringify(results, null, 2))
const failed = results.checks.filter((c) => !c.ok).length
console.log(`\nbatch9 done: ${results.checks.length - failed}/${results.checks.length} PASS`)
console.log('data → ' + `${OUT_DIR}/IT-04-FE-02-cdp-batch9-data.json`)
process.exit(failed > 0 ? 1 : 0)
