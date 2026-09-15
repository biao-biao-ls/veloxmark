// CDP smoke test against a running Electron with --remote-debugging-port=9223
import { writeFileSync } from 'node:fs'

const CDP = 'http://127.0.0.1:9223'

async function getTarget() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${CDP}/json`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('no CDP page target')
}

const target = await getTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
  }
})

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id
    pending.set(msgId, { resolve, reject })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
}

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result.value
}

async function screenshot(path) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(path, Buffer.from(r.data, 'base64'))
  console.log('saved', path)
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

await new Promise((resolve) => ws.addEventListener('open', resolve))
await send('Page.enable')
await send('Runtime.enable')
await wait(2500)

// 1. light theme overview: menubar, outline text, window controls
const light = await evaluate(`(() => {
  const tb = document.querySelector('.titlebar')
  return {
    menubarLabels: [...document.querySelectorAll('.menubar-label')].map(b => b.textContent),
    outlineTexts: [...document.querySelectorAll('.outline-item')].slice(0, 4).map(b => b.textContent),
    windowControls: document.querySelectorAll('.wc-btn').length,
    titlebarBg: tb ? getComputedStyle(tb).backgroundColor : null
  }
})()`)
console.log('LIGHT:', JSON.stringify(light, null, 2))
await screenshot('D:/code/typora/scripts/v2-light.png')

// 2. open File menu dropdown (light)
await evaluate(`document.querySelectorAll('.menubar-label')[0].click()`)
await wait(400)
await screenshot('D:/code/typora/scripts/v2-light-menu.png')
await evaluate(`document.body.click()`)

// 3. toggle dark theme
await evaluate(`[...document.querySelectorAll('.tb-btn')].find(b => b.title.includes('theme')).click()`)
await wait(600)
const dark = await evaluate(`(() => {
  const tb = document.querySelector('.titlebar')
  const editor = document.querySelector('.cm-editor')
  return {
    appClass: document.querySelector('.app').className,
    titlebarBg: getComputedStyle(tb).backgroundColor,
    editorBg: editor ? getComputedStyle(editor).backgroundColor : null,
    outlineTexts: [...document.querySelectorAll('.outline-item')].slice(0, 3).map(b => b.textContent)
  }
})()`)
console.log('DARK:', JSON.stringify(dark, null, 2))

// 4. open File dropdown in dark theme
await evaluate(`document.querySelectorAll('.menubar-label')[0].click()`)
await wait(400)
await screenshot('D:/code/typora/scripts/v2-dark-menu.png')

ws.close()
process.exit(0)
