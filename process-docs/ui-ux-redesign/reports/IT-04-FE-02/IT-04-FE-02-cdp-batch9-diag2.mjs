#!/usr/bin/env node
// batch9 诊断 2：剪贴板通道 + 富文本渲染源
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
async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) return { ERR: JSON.stringify(r.exceptionDetails).slice(0, 300) }
  return r.result.value
}

// 1) 纯文本剪贴板 roundtrip
console.log('textRoundtrip', JSON.stringify(await ev(`(async () => {
  await window.api.clipboardWrite('batch9-clip-test-' + Date.now())
  await new Promise((r) => setTimeout(r, 250))
  const t = await window.api.clipboardRead()
  return { readBack: (t ?? '').slice(0, 40), ok: (t ?? '').includes('batch9-clip-test-') }
})()`)))

// 2) HTML 剪贴板 roundtrip（走 clipboardWriteHtml）
console.log('htmlRoundtrip', JSON.stringify(await ev(`(async () => {
  await window.api.clipboardWriteHtml('<p style="color:#333333">batch9-html-test</p>', 'batch9-html-test')
  await new Promise((r) => setTimeout(r, 250))
  const clip = await window.api.clipboardReadHtml()
  return { htmlLen: (clip?.html ?? '').length, textLen: (clip?.text ?? '').length, head: (clip?.html ?? '').slice(0, 80), ok: (clip?.html ?? '').includes('batch9-html-test') }
})()`)))

// 3) copyRichText 再测 + 文档内容
console.log('docHead', JSON.stringify(await ev(`window.__veloxEditor?.view ? window.__veloxEditor.view.state.doc.toString().slice(0, 120) : null`)))
console.log('copyRich2', JSON.stringify(await ev(`(async () => {
  const ok = await window.__veloxP20.copyRichText()
  await new Promise((r) => setTimeout(r, 250))
  const clip = await window.__veloxP20.getClipboard()
  return { ok, htmlLen: (clip?.html ?? '').length, textLen: (clip?.text ?? '').length, head: (clip?.html ?? '').slice(0, 100) }
})()`)))

// 4) 直接看 P20 缝可用方法 + try/catch copyRichTextToClipboard 路径错误
console.log('p20Keys', JSON.stringify(await ev(`Object.keys(window.__veloxP20 ?? {})`)))
console.log('copyRichErr', JSON.stringify(await ev(`(async () => {
  try {
    await window.__veloxP20.copyRichText()
    return { threw: false }
  } catch (e) {
    return { threw: true, msg: String(e && e.message || e).slice(0, 300), stack: String(e && e.stack || '').slice(0, 400) }
  }
})()`)))
process.exit(0)
