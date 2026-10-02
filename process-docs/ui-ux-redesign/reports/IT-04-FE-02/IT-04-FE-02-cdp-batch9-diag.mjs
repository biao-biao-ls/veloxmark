#!/usr/bin/env node
// batch9 现场诊断（临时探针，非交付物）——zoom/clipboard/⋮ 菜单/toast 路径
const PORT = 9563
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
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) return { ERR: JSON.stringify(r.exceptionDetails).slice(0, 250) }
  return r.result.value
}
async function clickAt(x, y, button = 'left') {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons: button === 'right' ? 2 : 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: 1 })
}

// 收掉可能残留的对话框（点「稍后」/「取消」）
for (let i = 0; i < 4; i++) {
  const btn = await ev(`(() => {
    const d = document.querySelector('.dialog-overlay')
    if (!d) return null
    const btns = [...d.querySelectorAll('button')]
    const byText = (t) => btns.find((b) => (b.textContent ?? '').trim() === t)
    const target = byText('稍后') ?? byText('取消') ?? btns[0] ?? null
    if (!target) return null
    const r = target.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: (target.textContent ?? '').trim() }
  })()`)
  if (!btn) break
  await clickAt(btn.x, btn.y)
  await sleep(350)
}
console.log('seams', JSON.stringify(await ev(`({p20: !!window.__veloxP20, p12: !!window.__veloxP12, p22: !!window.__veloxP22, ed: !!window.__veloxEditor})`)))
console.log('docLen', JSON.stringify(await ev(`window.__veloxEditor?.view ? window.__veloxEditor.view.state.doc.length : null`)))
console.log('zoom', JSON.stringify(await ev(`(() => ({
  dpr: devicePixelRatio,
  htmlZoom: getComputedStyle(document.documentElement).zoom,
  bodyZoom: getComputedStyle(document.body).zoom,
  vvScale: visualViewport?.scale,
  gridCellVar: getComputedStyle(document.documentElement).getPropertyValue('--grid-cell-size'),
  pickerBorder: document.querySelector('.table-grid-picker') ? getComputedStyle(document.querySelector('.table-grid-picker')).borderTopWidth : null,
  anyBtnBorder: getComputedStyle(document.querySelector('button') ?? document.body).borderTopWidth,
  cmZoom: document.querySelector('.cm-editor') ? getComputedStyle(document.querySelector('.cm-editor')).zoom : null
}))()`)))
console.log('copyRich', JSON.stringify(await ev(`(async () => {
  const ok = await window.__veloxP20.copyRichText()
  const clip = await window.__veloxP20.getClipboard()
  return { ok, htmlLen: (clip?.html ?? '').length, textLen: (clip?.text ?? '').length, htmlHead: (clip?.html ?? '').slice(0, 150) }
})()`)))

// ── ⋮ 菜单路径：直接 clickAt td（不经 grid picker Escape）──────────────────
await ev(`window.__veloxEditor?.view?.focus?.()`)
const td = await ev(`(() => {
  const td = document.querySelector('.cm-md-table-wrap table tr td')
  if (!td) return null
  td.scrollIntoView({ block: 'center' })
  const r = td.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, rect: [r.left, r.top, r.width, r.height].map((v) => Math.round(v)) }
})()`)
console.log('td', JSON.stringify(td))
if (td) await clickAt(td.x, td.y)
await sleep(800)
console.log('toolbarAfterTdClick', JSON.stringify(await ev(`(() => ({
  resizeBtn: !!document.querySelector('[data-op="resizeTable"]'),
  moreBtn: !!document.querySelector('[data-op="TBL-MOR-OPN"]'),
  toolbar: !!document.querySelector('.table-toolbar, [data-op="resizeTable"]')
}))()`)))
const moreBtn = await ev(`(() => {
  const b = document.querySelector('[data-op="TBL-MOR-OPN"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})()`)
console.log('moreBtn', JSON.stringify(moreBtn))
if (moreBtn) await clickAt(moreBtn.x, moreBtn.y)
await sleep(600)
console.log('menuOpen', JSON.stringify(await ev(`(() => {
  const menu = document.querySelector('.velox-ctx-menu, .editor-context-menu')
  if (!menu) return { open: false }
  const labels = [...menu.querySelectorAll('.velox-ctx-label')].map((e) => (e.textContent ?? '').trim()).slice(0, 25)
  const ops = [...menu.querySelectorAll('[data-op]')].map((e) => e.getAttribute('data-op')).slice(0, 25)
  const groupCandidates = [...menu.querySelectorAll('*')].map((e) => String(e.className)).filter((c) => /group/i.test(c))
  return { open: true, labels, ops, groupCandidates: [...new Set(groupCandidates)].slice(0, 8) }
})()`)))

// ── 点 insertRowBelow → toast ─────────────────────────────────────────────
const insRow = await ev(`(() => {
  const b = document.querySelector('[data-op="insertRowBelow"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: b.disabled === true || b.getAttribute('aria-disabled') === 'true', text: (b.textContent ?? '').trim() }
})()`)
console.log('insRow', JSON.stringify(insRow))
if (insRow && !insRow.disabled) await clickAt(insRow.x, insRow.y)
await sleep(900)
console.log('toastAfterInsert', JSON.stringify(await ev(`(() => {
  const msg = document.querySelector('.toast-msg')
  const undo = document.querySelector('.toast-undo-btn')
  const toast = document.querySelector('.toast')
  return {
    hasToast: !!toast,
    msg: msg ? (msg.textContent ?? '').trim() : null,
    hasUndo: !!undo,
    undoText: undo ? (undo.textContent ?? '').trim() : null,
    toastClass: toast ? String(toast.className) : null
  }
})()`)))
console.log('docLenAfterOp', JSON.stringify(await ev(`window.__veloxEditor?.view ? window.__veloxEditor.view.state.doc.length : null`)))
console.log('done')
process.exit(0)
