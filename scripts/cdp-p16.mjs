// CDP e2e test for P16 (Mermaid UX). Port 9233.
//   npm run build && node scripts/cdp-p16.mjs
//
// Acceptance coverage (docs/requirements/P16-mermaid-ux.md)
//   ① break syntax  — old SVG kept dimmed + error bar; fix restores in place
//   ② Insert menu   — sequence template (Chinese comments) renders; fence no-op
//   ③ PNG / Copy    — 2× PNG data via stubbed save + clipboardWriteImage
//   ④ lightbox      — svg-body click opens; wheel zoom; Esc closes; padding→source
//   ⑤ dark theme    — error bar + lightbox mask contrast on .theme-dark
import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9233
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p16')
mkdirSync(TMP, { recursive: true })

let app = null
let ws = null
const failures = []

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures.push(name)
}

function launch() {
  console.log('launching electron on port', CDP_PORT)
  const logPath = join(TMP, 'app-main.log')
  appendFileSync(logPath, `\n=== launch ${new Date().toISOString()} ===\n`)
  const child = spawn(ELECTRON_BIN, ['.', `--remote-debugging-port=${CDP_PORT}`], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false
  })
  child.stdout.on('data', (d) => appendFileSync(logPath, d))
  child.stderr.on('data', (d) => appendFileSync(logPath, d))
  return child
}

async function getTarget(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
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

async function main() {
  if (!ELECTRON_BIN) throw new Error('electron binary not found')

  let id = 0
  const session = { send: null, evaluate: null }

  async function connect() {
    const target = await getTarget()
    ws = new WebSocket(target.webSocketDebuggerUrl)
    const pending = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)
        pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      }
    })
    ws.addEventListener('close', () => {
      for (const { reject } of pending.values()) reject(new Error('CDP websocket closed'))
      pending.clear()
    })
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('CDP websocket open timeout')), 12000)
      ws.addEventListener('open', () => {
        clearTimeout(t)
        resolve()
      })
      ws.addEventListener('error', (e) => {
        clearTimeout(t)
        reject(e)
      })
    })
    id = 0
    session.send = (method, params = {}) => {
      const msgId = ++id
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          pending.delete(msgId)
          reject(new Error(`CDP timeout: ${method}`))
        }, 20000)
        pending.set(msgId, {
          resolve: (v) => {
            clearTimeout(t)
            resolve(v)
          },
          reject: (e) => {
            clearTimeout(t)
            reject(e)
          }
        })
        try {
          ws.send(JSON.stringify({ id: msgId, method, params }))
        } catch (e) {
          pending.delete(msgId)
          reject(e)
        }
      })
    }
    session.evaluate = async (expr) => {
      const r = await session.send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      })
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
      return r.result.value
    }
    await session.send('Page.enable')
    await session.send('Runtime.enable')
  }

  const evaluate = (expr) => session.evaluate(expr)
  const waitFor = async (expr, ms = 15000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      try {
        if (await evaluate(expr)) return true
      } catch {}
      await new Promise((r) => setTimeout(r, 150))
    }
    return false
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  // ---- boot: English pin + draft wipe + reload -------------------------------
  app = launch()
  await connect()
  await waitFor(`typeof window.__veloxPrefs === 'object' && typeof window.__veloxEditor === 'object'`, 30000)
  await evaluate(`(async () => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') || '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw,
      language: 'en',
      crashRecoveryEnabled: false,
      autoSaveMode: 'off',
      restoreLastSession: false,
      showStatusBar: true,
      theme: 'light',
      focusMode: false,
      typewriterMode: false,
      sourceMode: false
    }))
    try {
      const drafts = await window.api.draftList()
      for (const d of drafts ?? []) await window.api.draftDiscard(d.path)
    } catch {}
    return true
  })()`)
  await evaluate(`location.reload()`)
  await wait(1500)
  await waitFor(`typeof window.__veloxP16 === 'object' && window.__veloxP16 !== null`, 30000)
  await waitFor(`document.querySelector('.status-bar') !== null`)
  check('__veloxP16 hook ready', (await evaluate(`typeof window.__veloxP16`)) === 'object')

  const VALID_FENCE = '```mermaid\nflowchart TD\n    A[Start] --> B[End]\n```\n'
  // Trailing plain line: P09 reveals fence source whenever the cursor is
  // inside it, so every scenario parks the cursor out here to see the widget.
  const parkOutside = `(() => {
    const v = window.__veloxEditor.view
    const end = v.state.doc.length
    const text = v.state.doc.toString()
    if (!text.endsWith('\\noutside\\n')) {
      v.dispatch({ changes: { from: end, insert: '\\noutside\\n' } })
    }
    const len = v.state.doc.length
    v.dispatch({ selection: { anchor: len - 1 } })
    return v.state.selection.main.head
  })()`

  // ---- ② Insert menu → template picker → sequence diagram --------------------
  console.log('\n--- insert mermaid template via menu ---')
  await evaluate(`window.__veloxEditor.view.dispatch({ changes: { from: 0, to: window.__veloxEditor.view.state.doc.length, insert: '# P16\\n' }, selection: { anchor: 6 } })`)
  await evaluate(`(() => {
    const labels = [...document.querySelectorAll('.menubar-label')]
    const insert = labels.find((b) => b.textContent.trim() === 'Insert')
    if (!insert) return 'no-insert-label:' + labels.map(b => b.textContent.trim()).join(',')
    insert.click()
    return true
  })()`).then((r) => check('Insert menu opens', r === true, String(r)))
  await wait(200)
  const cmdClicked = await evaluate(`(() => {
    const items = [...document.querySelectorAll('.menu-dropdown button.menu-item')]
    const target = items.find((b) => (b.querySelector('.menu-item-label')?.textContent ?? b.textContent).trim() === 'Mermaid Diagram…')
    if (!target) return 'items:' + items.map((b) => (b.querySelector('.menu-item-label')?.textContent ?? '').trim()).join(',')
    target.click()
    return true
  })()`)
  check('Mermaid Diagram… command clicked', cmdClicked === true, String(cmdClicked))
  await waitFor(`window.__veloxP16.getDialogOpen() === true`)
  check('template picker dialog open', (await evaluate(`window.__veloxP16.getDialogOpen()`)) === true)
  const pickLabels = await evaluate(`[...document.querySelectorAll('.list-pick-item')].map(b => b.textContent.trim())`)
  check(
    'picker lists 7 English template names',
    Array.isArray(pickLabels) && pickLabels.length === 7 && pickLabels.some((l) => l.includes('Sequence')),
    JSON.stringify(pickLabels)
  )
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('.list-pick-item')].find((b) => b.textContent.includes('Sequence'))
    if (!btn) return false
    btn.click()
    return true
  })()`)
  await waitFor(`window.__veloxP16.getDialogOpen() === false`)
  const seqDoc = await evaluate(`window.__veloxEditor.view.state.doc.toString()`)
  check(
    'sequence fence inserted with Chinese comments',
    typeof seqDoc === 'string' && seqDoc.includes('sequenceDiagram') && seqDoc.includes('```mermaid') && seqDoc.includes('%%') && /[一-鿿]/.test(seqDoc),
    JSON.stringify(seqDoc)?.slice(0, 160)
  )
  const cursorInFence = await evaluate(`window.__veloxP16.isCursorInMermaidFence()`)
  check('cursor landed inside the new fence', cursorInFence === true, String(cursorInFence))
  const cursorText = await evaluate(`(() => {
    const v = window.__veloxEditor.view
    const head = v.state.selection.main.head
    return v.state.doc.sliceString(head, head + 6)
  })()`)
  check('cursor sits on first editable token (客户端)', String(cursorText).startsWith('客户端'), String(cursorText))
  // Insert command no-op while cursor is inside the fence
  const noop = await evaluate(`(() => {
    window.__veloxP16.openInsertDialog()
    return window.__veloxP16.getDialogOpen()
  })()`)
  check('insert dialog no-op inside mermaid fence', noop === false, String(noop))
  // Park cursor outside → P09 un-reveals the widget → diagram renders;
  // Insert dialog opens again outside the fence.
  const outsideOpen = await evaluate(`(() => {
    ${parkOutside}
    window.__veloxP16.openInsertDialog()
    return true
  })()`)
  const dialogDomOpen = await waitFor(`document.querySelector('.list-pick-dialog') !== null`, 5000)
  check('insert dialog opens outside fence', outsideOpen === true && dialogDomOpen === true, `eval=${outsideOpen} dom=${dialogDomOpen}`)
  await evaluate(`(() => { document.querySelector('.list-pick-overlay')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return true })()`)
  await waitFor(`document.querySelector('.list-pick-dialog') === null`)
  const seqSvg = await waitFor(`document.querySelector('.cm-md-mermaid svg') !== null`, 20000)
  check('sequence diagram renders svg (cursor parked outside)', seqSvg === true)
  await evaluate(`(() => { document.querySelector('.list-pick-overlay')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return true })()`)
  await waitFor(`window.__veloxP16.getDialogOpen() === false`)

  // ---- ① error keeps old SVG; fix restores in place --------------------------
  console.log('\n--- error state keeps old render ---')
  await evaluate(`window.__veloxP14.loadDoc(${JSON.stringify(VALID_FENCE)}, '/tmp/velox-p16/m.md')`)
  await evaluate(parkOutside)
  const okSvg = await waitFor(`(() => { const s = document.querySelector('.cm-md-mermaid svg'); const e = document.querySelector('.cm-md-mermaid-error'); return !!s && (!e || e.hidden) })()`, 20000)
  check('valid flowchart renders without error bar', okSvg === true)
  const svgLenBefore = await evaluate(`document.querySelector('.cm-md-mermaid svg')?.outerHTML.length ?? 0`)
  check('svg produced', svgLenBefore > 50, String(svgLenBefore))

  // Break the syntax in place: B[End] → B[End (unclosed bracket)
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    const doc = v.state.doc.toString()
    const idx = doc.indexOf('B[End]')
    v.dispatch({ changes: { from: idx, to: idx + 6, insert: 'B[End' } })
    return true
  })()`)
  await evaluate(parkOutside)
  const errShown = await waitFor(`(() => { const e = document.querySelector('.cm-md-mermaid-error'); return !!e && !e.hidden && e.textContent.length > 5 })()`, 20000)
  check('error bar appears after breaking syntax', errShown === true)
  const dimmed = await evaluate(`!!document.querySelector('.cm-md-mermaid-svg.is-dim svg')`)
  check('old SVG kept dimmed under the error', dimmed === true)
  const errText = await evaluate(`document.querySelector('.cm-md-mermaid-error')?.textContent ?? ''`)
  check('error bar carries a message', errText.length > 10, errText.slice(0, 120))
  const jumpBtn = await evaluate(`!!document.querySelector('.cm-md-mermaid-jump')`)
  check('jump-to-source button present', jumpBtn === true)
  const jumped = await evaluate(`(() => {
    const btn = document.querySelector('.cm-md-mermaid-jump')
    if (!btn) return null
    btn.click()
    const v = window.__veloxEditor.view
    const head = v.state.selection.main.head
    return { head, line: v.state.doc.lineAt(head).number }
  })()`)
  check(
    'jump-to-source moves the cursor into the fence',
    !!jumped && jumped.head > 0 && jumped.line >= 2 && jumped.line <= 5,
    JSON.stringify(jumped)
  )
  await evaluate(parkOutside)

  // Fix syntax → diagram restores in place, error clears
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    const doc = v.state.doc.toString()
    const idx = doc.indexOf('B[End')
    v.dispatch({ changes: { from: idx, to: idx + 5, insert: 'B[End]' } })
    return true
  })()`)
  await evaluate(parkOutside)
  const fixed = await waitFor(`(() => { const e = document.querySelector('.cm-md-mermaid-error'); const s = document.querySelector('.cm-md-mermaid-svg svg'); return (!e || e.hidden) && !!s && !document.querySelector('.cm-md-mermaid-svg.is-dim') })()`, 20000)
  check('fix restores diagram in place, error cleared', fixed === true)

  // ---- ③ PNG export + Copy Image ---------------------------------------------
  // window.api is frozen by contextBridge — route through the P16 export IO
  // seam (setMermaidExportIo) exposed on __veloxP16.setExportIo.
  console.log('\n--- PNG export + clipboard copy ---')
  await evaluate(`(() => {
    window.__p16 = {}
    window.__veloxP16.setExportIo({
      showSaveDialog: async (name) => { window.__p16.dialogName = name; return '/tmp/velox-p16/diagram.png' },
      writeFileBase64: async (p, b64) => { window.__p16.pngPath = p; window.__p16.pngB64 = b64; return true },
      clipboardWriteImage: async (dataUrl) => { window.__p16.clip = dataUrl; return true }
    })
    return true
  })()`)
  const pngClicked = await evaluate(`(() => {
    const btns = [...document.querySelectorAll('.cm-md-mermaid .cm-md-block-toolbar-btn')]
    const png = btns.find((b) => b.textContent.trim() === 'PNG')
    if (!png) return 'btns:' + btns.map((b) => b.textContent.trim()).join(',')
    png.click()
    return true
  })()`)
  check('PNG toolbar button clicked', pngClicked === true, String(pngClicked))
  const pngSaved = await waitFor(`!!(window.__p16 && window.__p16.pngB64 && window.__p16.pngB64.length > 100)`, 15000)
  check('PNG written via writeFileBase64', pngSaved === true)
  const pngMeta = await evaluate(`({ name: window.__p16.dialogName, path: window.__p16.pngPath, head: (window.__p16.pngB64 || '').slice(0, 8), len: (window.__p16.pngB64 || '').length })`)
  check(
    'PNG save dialog default name diagram.png + magic bytes',
    pngMeta && pngMeta.name === 'diagram.png' && String(pngMeta.head).startsWith('iVBOR') && pngMeta.len > 100,
    JSON.stringify(pngMeta)
  )

  const copyClicked = await evaluate(`(() => {
    const btns = [...document.querySelectorAll('.cm-md-mermaid .cm-md-block-toolbar-btn')]
    const c = btns.find((b) => b.textContent.trim() === 'Copy Image')
    if (!c) return 'btns:' + btns.map((b) => b.textContent.trim()).join(',')
    c.click()
    return true
  })()`)
  check('Copy Image toolbar button clicked', copyClicked === true, String(copyClicked))
  const clipOk = await waitFor(`!!(window.__p16 && window.__p16.clip && window.__p16.clip.startsWith('data:image/png;base64,') && window.__p16.clip.length > 100)`, 15000)
  const clipLen = await evaluate(`(window.__p16?.clip ?? '').length`)
  check('clipboardWriteImage got a PNG data URL', clipOk === true, `len=${clipLen}`)

  // ---- ④ lightbox: open / wheel zoom / Esc / padding → source ----------------
  console.log('\n--- lightbox ---')
  const sourceFrom = await evaluate(`(() => {
    // fence starts at doc pos 0 for VALID_FENCE
    return 0
  })()`)
  const opened = await evaluate(`(() => {
    const svg = document.querySelector('.cm-md-mermaid-svg svg')
    if (!svg) return 'no-svg'
    svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return true
  })()`)
  const lightboxUp = await waitFor(`document.querySelector('.vm-mermaid-lightbox') !== null`, 5000)
  check('svg-body click opens lightbox', opened === true && lightboxUp === true, `eval=${opened} dom=${lightboxUp}`)
  // Let the lightbox's centering rAF + wheel-listener effect settle.
  await wait(300)
  const scaleBefore = await evaluate(`(() => {
    const el = document.querySelector('.vm-mermaid-lightbox-content')
    const m = /scale\\(([-\\d.]+)\\)/.exec(el?.style.transform ?? '')
    return m ? Number(m[1]) : null
  })()`)
  await evaluate(`(() => {
    const stage = document.querySelector('.vm-mermaid-lightbox-stage')
    const rect = stage.getBoundingClientRect()
    stage.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, bubbles: true, cancelable: true }))
    return true
  })()`)
  await wait(100)
  const scaleAfter = await evaluate(`(() => {
    const el = document.querySelector('.vm-mermaid-lightbox-content')
    const m = /scale\\(([-\\d.]+)\\)/.exec(el?.style.transform ?? '')
    return m ? Number(m[1]) : null
  })()`)
  check(
    'wheel zoom changes scale from 1',
    typeof scaleBefore === 'number' && typeof scaleAfter === 'number' && scaleAfter > scaleBefore && scaleBefore === 1,
    `before=${scaleBefore} after=${scaleAfter}`
  )
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  await wait(100)
  check('Esc closes lightbox', (await evaluate(`document.querySelector('.vm-mermaid-lightbox') === null`)) === true)

  // Padding click (block gap, not svg) → cursor jumps to fence start
  const padJump = await evaluate(`(() => {
    const v = window.__veloxEditor.view
    v.dispatch({ selection: { anchor: v.state.doc.length } })
    const wrap = document.querySelector('.cm-md-mermaid')
    if (!wrap) return 'no-wrap'
    wrap.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    return v.state.selection.main.head
  })()`)
  check('padding click jumps cursor to source', padJump === sourceFrom, `head=${padJump}`)

  // ---- ⑤ dark theme contrast --------------------------------------------------
  console.log('\n--- dark theme ---')
  await evaluate(`window.__veloxPrefs.setPreferences({ theme: 'dark' })`)
  await waitFor(`document.querySelector('.app.theme-dark') !== null`)
  // Break the diagram again to surface the error bar in dark mode
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    const doc = v.state.doc.toString()
    const idx = doc.indexOf('B[End]')
    if (idx >= 0) v.dispatch({ changes: { from: idx, to: idx + 6, insert: 'B[End' } })
    return true
  })()`)
  await evaluate(parkOutside)
  const darkErr = await waitFor(`(() => { const e = document.querySelector('.theme-dark .cm-md-mermaid-error'); return !!e && !e.hidden })()`, 20000)
  check('dark theme renders the error bar', darkErr === true)
  const darkErrColor = await evaluate(`(() => {
    const e = document.querySelector('.theme-dark .cm-md-mermaid-error')
    return e ? getComputedStyle(e).color : ''
  })()`)
  // theme-dark amber is #fcd34d → rgb(252, 211, 77)
  check('dark error bar uses light-on-dark amber', darkErrColor === 'rgb(252, 211, 77)', darkErrColor)

  await evaluate(`(() => {
    // restore valid syntax then open lightbox to sample the mask color
    const v = window.__veloxEditor.view
    const doc = v.state.doc.toString()
    const idx = doc.indexOf('B[End')
    if (idx >= 0) v.dispatch({ changes: { from: idx, to: idx + 5, insert: 'B[End]' } })
    return true
  })()`)
  await evaluate(parkOutside)
  await waitFor(`!!document.querySelector('.cm-md-mermaid-svg svg') && !document.querySelector('.cm-md-mermaid-svg.is-dim')`, 20000)
  const maskAlpha = await evaluate(`(() => {
    const svg = document.querySelector('.cm-md-mermaid-svg svg')
    if (!svg) return 'no-svg'
    svg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return true
  })()`)
  const darkLightboxUp = await waitFor(`document.querySelector('.vm-mermaid-lightbox') !== null`, 5000)
  const maskVal = darkLightboxUp
    ? await evaluate(`(() => {
        const box = document.querySelector('.vm-mermaid-lightbox')
        if (!box) return null
        const bg = getComputedStyle(box).backgroundColor
        const m = /rgba?\\(([^)]+)\\)/.exec(bg)
        if (!m) return bg
        const parts = m[1].split(',').map((s) => s.trim())
        return parts.length >= 4 ? Number(parts[3]) : 1
      })()`)
    : null
  check(
    'dark lightbox mask is strongly opaque',
    maskAlpha === true && typeof maskVal === 'number' && maskVal >= 0.75,
    `open=${maskAlpha} darkUp=${darkLightboxUp} alpha=${maskVal}`
  )
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)

  // restore light theme for any follow-up suites sharing the profile
  await evaluate(`window.__veloxPrefs.setPreferences({ theme: 'light' })`)

  console.log('')
  if (failures.length) console.error(`P16 e2e: ${failures.length} FAILURE(S)`)
  else console.log('P16 e2e: ALL PASS')
  process.exit(failures.length ? 1 : 0)
}

const cleanup = () => {
  try {
    if (ws && ws.readyState === 1) ws.close()
  } catch {}
  if (app) {
    try {
      app.kill('SIGKILL')
    } catch {}
    app = null
  }
}

process.on('exit', cleanup)
process.on('SIGINT', () => process.exit(130))
process.on('SIGTERM', () => process.exit(143))

main()
  .catch((err) => {
    console.error('P16 e2e harness error:', err)
    process.exit(1)
  })
  .finally(cleanup)
