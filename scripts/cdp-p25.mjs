// CDP e2e test for P25 (Mermaid 源码实时预览, route B). Port 9242.
//   npm run build && node scripts/cdp-p25.mjs
//
// Acceptance coverage (docs/requirements/P25-mermaid-live-preview.md)
//   ① cursor enters a mermaid fence → panel appears with the current SVG
//   ② edit node name under the cursor → panel updates; syntax error shows
//      the error bar while KEEPING the last good SVG; fix restores
//   ③ cursor leaves the fence → panel collapses after ~2s (re-enter cancels);
//      pin keeps it open and locks content to the pinned fence; edits to the
//      pinned fence still follow (hash re-resolve)
//   ④ input responsiveness: doc edits are plain CM6 transactions (panel is a
//      projection — nothing writes back)
//   ⑤ single data source: panel DOM has no contenteditable; Ctrl+Z steps
//      undo each insert in the editor
// Plus: panel Copy-source copies fence body; drag-resize persists height to
// prefs; source-mode (P08) detection identical (syntax-tree based).
import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9242
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p25')
mkdirSync(TMP, { recursive: true })

const DOC_PATH = join(TMP, 'mermaid-preview.md')

// Two fences with distinct node names; markers for cursor targets.
const DOC = [
  '# P25 固定文档',
  '',
  '段落开头。',
  '',
  '```mermaid',
  'graph TD',
  '  AAA --> BBB',
  '```',
  '',
  '中间段落。',
  '',
  '```mermaid',
  'graph LR',
  '  XXX --> YYY',
  '```',
  '',
  '结尾段落。',
  ''
].join('\n')

const posOf = (needle, offsetIn = 0) => DOC.indexOf(needle) + offsetIn
const FENCE_A_BODY = DOC.indexOf('  AAA --> BBB')
const FENCE_B_BODY = DOC.indexOf('  XXX --> YYY')
const PARA_MID = DOC.indexOf('中间段落。')
const PARA_END = DOC.indexOf('结尾段落。')
// Fences shifted after edits — recompute from live doc in-page when needed.

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
      await new Promise((r) => setTimeout(r, 40))
    }
    return false
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  // ---- boot -------------------------------------------------------------------
  app = launch()
  await connect()
  await waitFor(
    `typeof window.__veloxPrefs === 'object' && typeof window.__veloxEditor === 'object'`,
    30000
  )
  await evaluate(`(async () => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') || '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw,
      language: 'zh',
      crashRecoveryEnabled: false,
      autoSaveMode: 'off',
      restoreLastSession: false,
      showStatusBar: true,
      theme: 'light',
      sourceMode: false,
      mermaidPreviewHeight: 240
    }))
    const sess = JSON.parse(localStorage.getItem('veloxmark.session') || '{}')
    localStorage.setItem('veloxmark.session', JSON.stringify({
      ...sess,
      sidebarVisible: false,
      mermaidPreviewPin: false
    }))
    try {
      const drafts = await window.api.draftList()
      for (const d of drafts) await window.api.draftRemove(d.path)
    } catch {}
  })()`)
  await evaluate(`location.reload()`)
  await waitFor(`typeof window.__veloxP25 === 'object' && window.__veloxP25 !== null`, 30000)
  await waitFor(`document.querySelector('.status-bar')`, 10000)
  await wait(300)

  const panel = () => evaluate(`window.__veloxP25.panel()`)
  const setCursor = async (pos) => {
    await evaluate(`window.__veloxP25.setCursor(${pos})`)
  }
  const insertText = async (pos, text) => {
    await evaluate(`window.__veloxP25.insertText(${pos}, ${JSON.stringify(text)})`)
  }
  // Live-doc position of a marker (doc shifts after edits).
  const livePos = (marker, offsetIn = 0) =>
    evaluate(
      `(() => { const d = window.__veloxP25.getDoc(); const i = d.indexOf(${JSON.stringify(marker)}); return i < 0 ? -1 : i + ${offsetIn} })()`
    )

  await evaluate(`window.__veloxP25.loadDoc(${JSON.stringify(DOC)}, ${JSON.stringify(DOC_PATH)})`)
  await wait(500) // live-preview mermaid widgets render first — warm the cache
  const bootPanel = await panel()
  check('boot: panel hidden with cursor outside fences', bootPanel.visible === false, JSON.stringify(bootPanel))

  // ---- ① enter fence A → panel + SVG quickly ---------------------------------
  await setCursor(FENCE_A_BODY + 3)
  const t0 = Date.now()
  const appeared = await waitFor(
    `(() => { const p = window.__veloxP25.panel(); return p.visible && p.hasSvg === true })()`,
    1500
  )
  const appearMs = Date.now() - t0
  check('enter fence: panel + SVG ≤ 0.8s', appeared && appearMs <= 800, `elapsed=${appearMs}ms`)
  let p = await panel()
  check('enter fence: no error bar on valid source', p.visible === true && p.errorText == null, JSON.stringify(p))
  check('enter fence: single-source — panel not editable', p.editableCount === 0, `editable=${p.editableCount}`)

  // ---- ② live edit follows + error keeps last good + fix restores -----------
  const aaaPos = await livePos('AAA --> BBB')
  await insertText(aaaPos, 'ZZZ --> ') // AAA --> BBB  →  ZZZ --> AAA --> BBB? no: insert at AAA start
  // inserted BEFORE "AAA --> BBB" so the line becomes "ZZZ --> AAA --> BBB"? Actually
  // insert at index of 'AAA...' prepends: "  ZZZ --> AAA --> BBB" — valid; svg gains ZZZ.
  const updated = await waitFor(
    `(() => { const p = window.__veloxP25.panel(); return p.visible && p.svgText.includes('ZZZ') })()`,
    1200
  )
  check('edit under cursor: panel SVG updated ≤1.2s', updated === true)

  // Syntax error: append a garbage line inside fence A (after the ZZZ line).
  const badPos = (await livePos('ZZZ --> AAA --> BBB')) + 'ZZZ --> AAA --> BBB'.length
  await insertText(badPos, '\n  this is (( not { valid mermaid')
  const errShown = await waitFor(
    `(() => { const p = window.__veloxP25.panel(); return p.visible && p.errorText != null })()`,
    1500
  )
  p = await panel()
  check('syntax error: error bar shown', errShown === true, JSON.stringify(p && p.errorText))
  check('syntax error: last good SVG kept (dimmed)', p.svgText.includes('ZZZ') === true)
  const undid = await evaluate(`window.__veloxP25.undo()`)
  check('error undo dispatched', undid === true)
  const errCleared = await waitFor(
    `(() => { const p = window.__veloxP25.panel(); return p.visible && p.errorText == null && p.hasSvg })()`,
    1500
  )
  check('error fixed: panel recovers', errCleared === true)

  // ---- ③ leave → 2s collapse; re-enter cancels ------------------------------
  const midPos = await livePos('中间段落。')
  await setCursor(midPos + 2)
  await wait(900)
  p = await panel()
  check('leave fence: still visible at ~0.9s (2s grace)', p.visible === true, JSON.stringify(p))
  const collapsed = await waitFor(`(() => window.__veloxP25.panel().visible === false)()`, 3000)
  check('leave fence: collapsed after ~2s', collapsed === true)

  // Re-enter then leave again quickly re-entering cancels the hide timer.
  const fenceAPos = await livePos('ZZZ --> AAA --> BBB')
  await setCursor(fenceAPos + 2)
  await waitFor(`(() => { const p = window.__veloxP25.panel(); return p.visible && p.hasSvg })()`, 1200)
  await setCursor((await livePos('段落开头。')) + 2)
  await wait(300)
  await setCursor(fenceAPos + 2) // re-enter within the 2s window
  await wait(2400)
  p = await panel()
  check('re-enter within grace: panel never collapsed', p.visible === true, JSON.stringify(p))

  // ---- ③ pin: stays open across fence switch; content locks to pinned -------
  const pinned = await evaluate(`window.__veloxP25.clickPin()`)
  check('pin clicked', pinned === true)
  p = await panel()
  check('pin: button shows pinned state', p.pinOn === true)
  const sessPin = await evaluate(`window.__veloxP25.getPinSession()`)
  check('pin: session flag persisted (P03)', sessPin === true)

  const fenceBPos = await livePos('XXX --> YYY')
  await setCursor(fenceBPos + 3)
  await wait(2600) // past the 2s collapse window
  p = await panel()
  check('pin: panel stays open with cursor in fence B', p.visible === true, JSON.stringify(p))
  check(
    'pin: content still fence A (ZZZ), not fence B (XXX)',
    p.svgText.includes('ZZZ') === true && p.svgText.includes('XXX') === false,
    `svg has ZZZ=${p.svgText.includes('ZZZ')} XXX=${p.svgText.includes('XXX')}`
  )

  // Pinned fence edits still follow (hash 变化跟随更新 → nearest fence).
  const bbbPos = await livePos('AAA --> BBB')
  await insertText(bbbPos + 'AAA --> BBB'.length, ' QQQ')
  // line: "  ZZZ --> AAA --> BBB QQQ" — mermaid node "BBB QQQ"? space makes it invalid…
  // safer: insert inside a fresh node ref. Undo and do a clean rename instead.
  await evaluate(`window.__veloxP25.undo()`)
  const renamePos = await livePos('AAA --> BBB')
  await insertText(renamePos, 'QQQ --> ') // "  QQQ --> AAA --> BBB"
  const followed = await waitFor(
    `(() => { const p = window.__veloxP25.panel(); return p.visible && p.svgText.includes('QQQ') })()`,
    1500
  )
  check('pin: pinned fence edits follow the panel', followed === true)

  // Unpin → panel follows the CURSOR again. The pin-follow inserts moved the
  // cursor into fence A, so re-seat it on fence B before probing.
  await evaluate(`window.__veloxP25.clickPin()`)
  const fenceBPos2 = await livePos('XXX --> YYY')
  await setCursor(fenceBPos2 + 3)
  await evaluate(`window.__veloxP25.probeNow()`)
  await wait(600)
  p = await panel()
  check(
    'unpin with cursor in fence B: panel switches to B',
    p.visible === true && p.svgText.includes('YYY') === true,
    JSON.stringify({ visible: p.visible, hasYYY: p.svgText.includes('YYY') })
  )

  // ---- Copy source + drag-resize → prefs -------------------------------------
  const copied = await evaluate(`(() => {
    const btn = document.querySelector('.mermaid-preview-copy-src')
    if (!btn) return false
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  })()`)
  check('copy-source button clicked', copied === true)
  await wait(250)
  const clip = await evaluate(`window.api.clipboardRead()`)
  check(
    'copy-source: fence B body on clipboard',
    typeof clip === 'string' && clip.includes('XXX --> YYY') && !clip.includes('```'),
    JSON.stringify(clip)
  )

  const prefsBefore = await evaluate(`window.__veloxP25.getPrefs()`)
  const resizeDragged = await evaluate(`(() => {
    const handle = document.querySelector('.mermaid-preview-resize')
    const panelEl = document.querySelector('.mermaid-preview-panel')
    if (!handle || !panelEl) return { ok: false }
    const r = handle.getBoundingClientRect()
    const y0 = r.top + 2
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientY: y0, clientX: r.left + 4 }))
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: y0 - 100, clientX: r.left + 4 }))
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientY: y0 - 100, clientX: r.left + 4 }))
    return { ok: true }
  })()`)
  await wait(250)
  const prefsAfter = await evaluate(`window.__veloxP25.getPrefs()`)
  const heightNow = await evaluate(`(() => {
    const el = document.querySelector('.mermaid-preview-panel')
    return el ? el.getBoundingClientRect().height : 0
  })()`)
  check(
    'drag-resize: panel grew ~100px',
    resizeDragged.ok === true && heightNow >= (prefsBefore.mermaidPreviewHeight ?? 240) + 80,
    JSON.stringify({ before: prefsBefore, heightNow })
  )
  check(
    'drag-resize: height persisted to prefs',
    prefsAfter.mermaidPreviewHeight >= (prefsBefore.mermaidPreviewHeight ?? 240) + 80,
    JSON.stringify(prefsAfter)
  )

  // ---- source mode (P08) behaves identically ---------------------------------
  await evaluate(`window.__veloxEditor.applyLivePreviewConfig(window.__veloxEditor.view, { mode: 'source' })`)
  await wait(300)
  await setCursor((await livePos('XXX --> YYY')) + 3)
  const srcMode = await waitFor(
    `(() => { const p = window.__veloxP25.panel(); return p.visible && p.hasSvg })()`,
    1500
  )
  check('source mode: panel detection identical (syntax-tree based)', srcMode === true)
  await evaluate(`window.__veloxEditor.applyLivePreviewConfig(window.__veloxEditor.view, { mode: 'live' })`)
  await wait(200)

  // ---- ⑤ single data source: undo steps + panel not editable ----------------
  const docBefore = await evaluate(`window.__veloxP25.getDoc()`)
  const endPos = await livePos('结尾段落。')
  await insertText(endPos, '一')
  // CM6 history groups changes within ~500ms into one undo step — space the
  // inserts so each Ctrl+Z reverts exactly one of them.
  await wait(650)
  await insertText(endPos + 1, '二')
  await wait(100)
  const docMid = await evaluate(`window.__veloxP25.getDoc()`)
  await evaluate(`window.__veloxP25.undo()`)
  await evaluate(`window.__veloxP25.undo()`)
  const docAfter = await evaluate(`window.__veloxP25.getDoc()`)
  check(
    'single source: two inserts then two undos restore the doc',
    docMid !== docBefore && docAfter === docBefore,
    `midChanged=${docMid !== docBefore} restored=${docAfter === docBefore}`
  )
  p = await panel()
  check('single source: panel DOM still has no editable fields', p.editableCount === 0)

  console.log(
    failures.length === 0
      ? '\nP25 e2e: ALL PASS'
      : `\nP25 e2e: ${failures.length} FAIL — ${failures.join(' | ')}`
  )
}

main()
  .catch((e) => {
    console.error('P25 e2e harness error:', e)
    process.exitCode = 1
  })
  .finally(() => {
    try {
      if (ws) ws.close()
    } catch {}
    try {
      if (app) app.kill('SIGKILL')
    } catch {}
    setTimeout(() => process.exit(process.exitCode ?? (failures.length ? 1 : 0)), 250)
  })
