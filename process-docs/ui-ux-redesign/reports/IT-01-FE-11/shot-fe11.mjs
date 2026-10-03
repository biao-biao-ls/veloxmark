// One-shot FE-11 evidence (r2 fix round): measure proof geometry + capture
// IT-01-FE-11-impl.png. Single Chrome/CDP session: Network.setCacheDisabled +
// Page.reload(ignoreCache) before capture to defeat stale cache. Max 1 run.
import { spawn } from 'node:child_process'
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9499
const DIR = 'D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-11'
const PAGE_URL = 'file:///D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-11/IT-01-FE-11-proof.html'
const OUT_PNG = join(DIR, 'IT-01-FE-11-impl.png')
const PROFILE = mkdtempSync(join(tmpdir(), 'fe11-chrome-'))

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--window-size=1240,1600',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    'about:blank'
  ],
  { stdio: 'ignore' }
)

async function waitForTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('CDP target not up')
}

const target = await waitForTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let id = 0
const pending = new Map()
const evWaiters = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data))
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id)
    pending.delete(m.id)
    if (m.error) rej(new Error(JSON.stringify(m.error)))
    else res(m.result)
  } else if (m.method && evWaiters.has(m.method)) {
    for (const r of evWaiters.get(m.method)) r(m.params)
    evWaiters.delete(m.method)
  }
}
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id
    pending.set(i, { res, rej })
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const waitEvent = (method) =>
  new Promise((res) => {
    if (!evWaiters.has(method)) evWaiters.set(method, [])
    evWaiters.get(method).push(res)
  })

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
  return r.result?.value
}

try {
  await send('Page.enable')
  await send('Network.enable')
  await send('Network.setCacheDisabled', { cacheDisabled: true }) // 防旧缓存

  const loaded = waitEvent('Page.loadEventFired')
  await send('Page.navigate', { url: PAGE_URL })
  await loaded
  const reloaded = waitEvent('Page.loadEventFired')
  await send('Page.reload', { ignoreCache: true }) // 取图前 reload 防旧缓存
  await reloaded
  await new Promise((r) => setTimeout(r, 400)) // let linked tokens.css apply

  const measure = await evaluate(`(() => {
    const root = getComputedStyle(document.documentElement)
    const btns = [...document.querySelectorAll('.undo-btn')].map((b) => {
      const cs = getComputedStyle(b)
      const r = b.getBoundingClientRect()
      return {
        theme: b.closest('.app')?.className,
        pad: cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft,
        padT: cs.paddingTop, padB: cs.paddingBottom,
        border: cs.borderTopWidth, lineH: cs.lineHeight, fontSize: cs.fontSize,
        h: +r.height.toFixed(1), w: +r.width.toFixed(1)
      }
    })
    const confs = [...document.querySelectorAll('.confirm-sim')].map((c) => {
      const r = c.getBoundingClientRect()
      return { theme: c.closest('.app')?.className, w: +r.width.toFixed(1), h: +r.height.toFixed(1) }
    })
    return {
      spaceHalf: root.getPropertyValue('--space-half').trim(),
      space2: root.getPropertyValue('--space-2').trim(),
      btns,
      confs,
      doc: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }
    }
  })()`)

  const metrics = await send('Page.getLayoutMetrics')
  const size = metrics.cssContentSize || metrics.contentSize
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: Math.ceil(size.width),
      height: Math.ceil(size.height),
      scale: 1
    }
  })
  writeFileSync(OUT_PNG, Buffer.from(shot.data, 'base64'))

  console.log(JSON.stringify({ measure, capture: { w: Math.ceil(size.width), h: Math.ceil(size.height) }, out: OUT_PNG }, null, 2))
} finally {
  try {
    ws.close()
  } catch {
    /* noop */
  }
  chrome.kill()
  try {
    rmSync(PROFILE, { recursive: true, force: true })
  } catch {
    /* noop */
  }
  process.exit(0)
}
