#!/usr/bin/env node
/** 批 A 收尾补拍：干净工具栏 impl 图 + ⊞ 网格弹层锚点图（无残留菜单）+ Esc 关菜单契约探针。 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = Number(process.env.FE01_CDP_PORT ?? 9534)
const OUT_DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-01'
const SHOTS = `${OUT_DIR}/shots`
const FIXTURE_PATH = 'D:/code/typora/temp/fe01-batcha-fixture.md'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
const send = (method, params = {}) => {
  const id = ++msgId
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
}
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value
async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}
async function pressEscape() {
  for (const type of ['rawKeyDown', 'keyUp'])
    await send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 })
}
async function shot(name) {
  const s = await send('Page.captureScreenshot', { format: 'png' })
  mkdirSync(SHOTS, { recursive: true })
  writeFileSync(`${SHOTS}/${name}`, Buffer.from(s.data, 'base64'))
  console.log('SHOT ', name)
}
const OVERLAY = `(() => ({
  menu: !!document.querySelector('.editor-context-menu, .velox-ctx-menu'),
  picker: !!document.querySelector('.table-grid-picker'),
  toolbars: document.querySelectorAll('.cm-md-table-toolbar').length,
  source: !!document.querySelector('.cm-md-table-toolbar-btn.is-source')
}))()`
const dismissDialog = async () => {
  const btn = await ev(`(() => {
    const d = document.querySelector('.dialog-overlay .dialog')
    if (!d) return null
    const btns = [...d.querySelectorAll('.dialog-buttons .dialog-btn')]
    const t = btns.find((b) => (b.textContent ?? '').trim() === '稍后') ?? btns[btns.length - 1]
    if (!t) return null
    const r = t.getBoundingClientRect()
    return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
  })()`)
  if (btn) { await clickAt(btn.x, btn.y); await sleep(350) }
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.bringToFront')
await send('Emulation.setFocusEmulationEnabled', { enabled: true })
await sleep(600)
await dismissDialog()

// Reset to fixture + clean edit on main table cell (1,1).
await ev(`window.__veloxP12.loadDoc(${JSON.stringify(`# FE-01 batch-A fixture

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
`)}, ${JSON.stringify(FIXTURE_PATH)})`)
await sleep(900)
await dismissDialog()

// Enter edit at (1,1) — Center column (▣ accent-soft pressed visible).
const cell = await ev(`(() => {
  const td = document.querySelectorAll('.cm-md-table-wrap')[0].querySelector('[data-row="1"][data-col="1"]')
  if (!td) return null
  td.scrollIntoView({ block: 'center' })
  const r = td.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2) }
})()`)
await sleep(200)
await clickAt(cell.x, cell.y)
await sleep(600)
console.log('edit state:', JSON.stringify(await ev(OVERLAY)))

// 1) clean toolbar impl shot
{
  const s = await send('Page.captureScreenshot', { format: 'png' })
  mkdirSync(SHOTS, { recursive: true })
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(`${SHOTS}/fe01-toolbar-pill-edit.png`, Buffer.from(s.data, 'base64'))
  writeFileSync(`${OUT_DIR}/IT-01-FE-01-impl.png`, Buffer.from(s.data, 'base64'))
  console.log('SHOT  fe01-toolbar-pill-edit.png + IT-01-FE-01-impl.png')
}

// 2) clean grid picker shot (explicitly ensure no ctx menu first)
await pressEscape(); await sleep(250) // exit edit
const cell2 = await ev(`(() => {
  const td = document.querySelectorAll('.cm-md-table-wrap')[0].querySelector('[data-row="1"][data-col="1"]')
  if (!td) return null
  td.scrollIntoView({ block: 'center' })
  const r = td.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +Math.min(Math.max(r.top + r.height / 2, 48), window.innerHeight - 48).toFixed(2) }
})()`)
await clickAt(cell2.x, cell2.y)
await sleep(600)
const gbtn = await ev(`(() => {
  const b = document.querySelector('.cm-md-table-toolbar-btn[data-op="resizeTable"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
await clickAt(gbtn.x, gbtn.y)
await sleep(450)
console.log('picker state:', JSON.stringify(await ev(OVERLAY)))
await shot('fe01-grid-picker-anchor.png')
await pressEscape(); await sleep(350)
console.log('after picker Esc:', JSON.stringify(await ev(OVERLAY)))

// 3) Esc-close-menu contract probe
const mbtn = await ev(`(() => {
  const b = document.querySelector('.cm-md-table-toolbar-btn[data-op="TBL-MOR-OPN"]')
  if (!b) return null
  const r = b.getBoundingClientRect()
  return { x: +(r.left + r.width / 2).toFixed(2), y: +(r.top + r.height / 2).toFixed(2) }
})()`)
await clickAt(mbtn.x, mbtn.y)
await sleep(450)
const openState = await ev(OVERLAY)
console.log('menu open:', JSON.stringify(openState))
await pressEscape(); await sleep(450)
const closedState = await ev(OVERLAY)
console.log('menu after Esc:', JSON.stringify(closedState))
console.log('ESC-CLOSE-CONTRACT:', openState.menu === true && closedState.menu === false ? 'PASS' : 'FAIL')
process.exit(0)
