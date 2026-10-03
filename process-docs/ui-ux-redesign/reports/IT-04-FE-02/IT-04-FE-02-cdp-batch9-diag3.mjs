#!/usr/bin/env node
// batch9 诊断 3：clipboardWrite 异常捕获 + 系统剪贴板对照
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
  if (r.exceptionDetails) return { ERR: JSON.stringify(r.exceptionDetails).slice(0, 400) }
  return r.result.value
}

const marker = 'batch9-sysclip-' + Date.now()
console.log('marker', marker)
console.log('writeProbe', JSON.stringify(await ev(`(async () => {
  const marker = ${JSON.stringify(marker)}
  try {
    const w = await window.api.clipboardWrite(marker)
    let wErr = null, wVal = w
    const t = await window.api.clipboardRead()
    return { writeResolved: true, writeVal: wVal, readBack: (t ?? '').slice(0, 60), match: (t ?? '') === marker }
  } catch (e) {
    return { writeResolved: false, err: String(e && e.message || e).slice(0, 300) }
  }
})()`)))
console.log('apiKeys', JSON.stringify(await ev(`Object.keys(window.api ?? {}).filter((k) => /clip/i.test(k))`)))
// preload 侧函数源码形状（不执行 IPC）——看是否是 stub
console.log('writeFnSrc', JSON.stringify(await ev(`String(window.api.clipboardWrite).slice(0, 220)`)))
console.log('readFnSrc', JSON.stringify(await ev(`String(window.api.clipboardRead).slice(0, 220)`)))
process.exit(0)
