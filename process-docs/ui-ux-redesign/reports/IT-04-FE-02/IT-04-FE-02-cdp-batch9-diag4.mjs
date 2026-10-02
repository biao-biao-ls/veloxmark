#!/usr/bin/env node
// batch9 诊断 4：绕开 OS 剪贴板锁，经 Vite 动态 import 复现 writeRichText 的
// wrapFragment(inlineStyleFragment(renderDoc(...))) 载荷（与 clipboardWriteHtml 同串）。
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
async function ev(expression, timeoutMs = 30000) {
  let timer
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('eval timeout')), timeoutMs) })
  try {
    const r = await Promise.race([
      send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      timeout
    ])
    if (r.exceptionDetails) return { ERR: JSON.stringify(r.exceptionDetails).slice(0, 500) }
    return r.result.value
  } finally { clearTimeout(timer) }
}

console.log('themeNow', JSON.stringify(await ev(`(() => document.querySelector('.app')?.className ?? document.documentElement.className)()`)))
console.log('importProbe', JSON.stringify(await ev(`(async () => {
  try {
    const m = await import('/src/export/inlineStyles.ts')
    return { ok: true, keys: Object.keys(m) }
  } catch (e) {
    return { ok: false, err: String(e && e.message || e).slice(0, 300) }
  }
})()`)))
console.log('richViaImport', JSON.stringify(await ev(`(async () => {
  try {
    const [{ inlineStyleFragment, wrapFragment }, { renderDoc }, { paletteFor }, lpMod] = await Promise.all([
      import('/src/export/inlineStyles.ts'),
      import('/src/export/renderDoc/index.ts'),
      import('/src/export/palette.ts'),
      import('/src/editor/livePreview/index.ts')
    ])
    const view = window.__veloxEditor.view
    const lp = lpMod.getLivePreviewConfig(view.state)
    const md = view.state.doc.toString()
    const fragment = await renderDoc(md, { baseDir: lp.baseDir, theme: lp.theme, imageMode: 'embed' })
    const html = wrapFragment(inlineStyleFragment(fragment, lp.theme), lp.theme)
    window.__veloxBatch9RichHtml = html
    return {
      ok: true,
      theme: lp.theme,
      fragLen: fragment.length,
      htmlLen: html.length,
      head: html.slice(0, 160),
      hasInline: html.includes('style='),
      palBg: paletteFor(lp.theme).bg
    }
  } catch (e) {
    return { ok: false, err: String(e && e.stack || e).slice(0, 500) }
  }
})()`)))
process.exit(0)
