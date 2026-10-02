#!/usr/bin/env node
// batch9 诊断 5：renderDoc 动态 import 失败原因
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
async function ev(expression, timeoutMs = 20000) {
  let timer
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('eval timeout')), timeoutMs) })
  try {
    const r = await Promise.race([
      send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      timeout
    ])
    if (r.exceptionDetails) return { ERR: JSON.stringify(r.exceptionDetails).slice(0, 600) }
    return r.result.value
  } finally { clearTimeout(timer) }
}

for (const mod of [
  '/src/export/renderDoc.ts',
  '/src/export/palette.ts',
  '/src/export/buildDocument.ts',
  '/src/export/copyRichText.ts',
  '/src/editor/livePreview/index.ts'
]) {
  console.log(mod, JSON.stringify(await ev(`(async () => {
    try {
      const m = await import('${mod}')
      return { ok: true, keys: Object.keys(m).slice(0, 12) }
    } catch (e) {
      return { ok: false, err: String(e && e.message || e).slice(0, 220) }
    }
  })()`)))
}
// 直接 fetch 看 dev server 返回
for (const mod of ['/src/export/renderDoc.ts', '/src/export/renderDoc.ts?import', '/src/export/listTable.ts']) {
  console.log('fetch', mod, JSON.stringify(await ev(`(async () => {
    try {
      const r = await fetch('${mod}')
      const t = await r.text()
      return { status: r.status, len: t.length, head: t.slice(0, 120) }
    } catch (e) {
      return { err: String(e && e.message || e).slice(0, 200) }
    }
  })()`)))
}
process.exit(0)
