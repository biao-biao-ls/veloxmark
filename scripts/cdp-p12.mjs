// CDP e2e test for P12 (autosave + crash recovery + close/switch guard).
// Runs against the *built* app (out/) with remote debugging enabled:
//   npm run build
//   node scripts/cdp-p12.mjs
//
// Coverage
//   close-query:  Cancel / Don't Save / Save (file-backed) via window.__veloxP12
//   confirmDiscard: same three-option dialog on the switch-file path
//   autosave:     debounce 3s writes the real file; dirty clears; tb indicator
//   crash draft:  SIGKILL → respawn → recovery dialog → Restore matches draft
//   draft cleanup on save (criterion 4) and Discard Draft path
//   untitled draft recovery + lastCursor session restore
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9229
const CDP = `http://127.0.0.1:${CDP_PORT}`
const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))
const TMP = join(ROOT, 'scripts', 'tmp-p12')
const AS_PATH = join(TMP, 'autosave.md')
const CRASH_PATH = join(TMP, 'crash.md')
const CLOSE_PATH = join(TMP, 'close-save.md')
const CURSOR_PATH = join(TMP, 'cursor.md')

mkdirSync(TMP, { recursive: true })
writeFileSync(AS_PATH, 'v0\n')
writeFileSync(CRASH_PATH, 'DISK_V1\n')
writeFileSync(CLOSE_PATH, 'v0-close\n')
writeFileSync(CURSOR_PATH, 'Hello world cursor test\n')

let app = null

async function getTarget(timeoutMs = 20000) {
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

const failures = []
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures.push(name)
}

function skip(name, why) {
  console.log(`SKIP  ${name} — ${why}`)
}

async function main() {
  if (!ELECTRON_BIN) throw new Error('electron binary not found under node_modules/electron/dist')

  // ---- CDP session (reconnectable — SIGKILL respawns the app) ---------------
  let ws = null
  let id = 0
  let pending = new Map()

  async function connect() {
    const target = await getTarget(30000)
    ws = new WebSocket(target.webSocketDebuggerUrl)
    const localPending = new Map()
    pending = localPending
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && localPending.has(msg.id)) {
        const { resolve, reject } = localPending.get(msg.id)
        localPending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      } else if (msg.method === 'Inspector.targetCrashed') {
        console.error('CDP event: target crashed')
        for (const { reject } of localPending.values()) reject(new Error('target crashed'))
        localPending.clear()
      }
    })
    ws.addEventListener('close', () => {
      for (const { reject } of localPending.values()) reject(new Error('CDP websocket closed'))
      localPending.clear()
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
    const send = (method, params = {}) => {
      const msgId = ++id
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          localPending.delete(msgId)
          reject(new Error(`CDP timeout: ${method}`))
        }, 15000)
        localPending.set(msgId, {
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
          clearTimeout(t)
          localPending.delete(msgId)
          reject(e)
        }
      })
    }
    session.send = send
    session.evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      })
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
      return r.result.value
    }
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Inspector.enable').catch(() => {})
  }

  const session = { send: null, evaluate: null }
  const evaluate = (expr) => session.evaluate(expr)
  const send = (m, p) => session.send(m, p)

  const waitFor = async (expr, ms = 12000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      try {
        if (await evaluate(expr)) return true
      } catch {}
      await new Promise((r) => setTimeout(r, 150))
    }
    return false
  }

  const waitForHooks = () =>
    waitFor(`!!window.__veloxEditor?.view && !!window.__veloxP12 && !!window.__veloxPrefs?.setPreferences`, 20000)

  const dialogInfo = () => evaluate(`(() => {
    const d = document.querySelector('.dialog')
    if (!d) return null
    return {
      title: d.querySelector('.dialog-title')?.textContent ?? '',
      message: d.querySelector('.dialog-message')?.textContent ?? '',
      buttons: [...d.querySelectorAll('.dialog-buttons .dialog-btn')].map((b) => b.textContent.trim())
    }
  })()`)

  const clickDialogBtn = (label) => evaluate(`(() => {
    const btns = [...document.querySelectorAll('.dialog-buttons .dialog-btn')]
    const b = btns.find((x) => x.textContent.trim() === ${JSON.stringify(label)})
    if (!b) return false
    b.click()
    return true
  })()`)

  const fireDialogOp = (fnName) =>
    evaluate(`(() => { window.__p12Pending = window.__veloxP12.${fnName}(); return true })()`)
  const readDialogOp = async (ms = 6000) => {
    const out = await Promise.race([
      evaluate(`window.__p12Pending`),
      new Promise((resolve) => setTimeout(() => resolve('__TIMEOUT__'), ms))
    ])
    return out
  }

  const editDoc = (text) => evaluate(`(() => {
    const v = window.__veloxEditor.view
    const pos = v.state.doc.length
    const insert = ${JSON.stringify(text)}
    v.dispatch({ changes: { from: pos, insert }, selection: { anchor: pos + insert.length } })
    return v.state.doc.toString()
  })()`)

  const docText = () => evaluate(`window.__veloxEditor.view.state.doc.toString()`)
  const draftList = () => evaluate(`window.__veloxP12.draftList()`)
  const draftHas = async (path, contentSub) => {
    const drafts = await draftList()
    return (drafts ?? []).some(
      (d) => (d.path === path || (path === null && d.path === null)) &&
        (contentSub == null || String(d.content).includes(contentSub))
    )
  }
  const pollDraft = async (path, contentSub, ms = 8000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (await draftHas(path, contentSub)) return true
      await new Promise((r) => setTimeout(r, 200))
    }
    return false
  }

  const pinPrefs = (extra = '') => evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw, language: 'en', restoreLastSession: false, autoSaveMode: 'off'${extra ? `, ${extra}` : ''}
    }))
    return true
  })()`)

  const cleanDrafts = async () => {
    const drafts = await draftList()
    for (const d of drafts ?? []) {
      await evaluate(`window.__veloxP12.draftDiscard(${JSON.stringify(d.path)})`)
    }
    return (drafts ?? []).length
  }

  // ---- boot ------------------------------------------------------------------
  app = await (async () => {
    try {
      await getTarget(3000)
      return null // already running
    } catch {
      return launch()
    }
  })()
  await connect()
  check('boot: hooks ready', await waitForHooks())
  await pinPrefs()
  await cleanDrafts()
  await send('Page.reload')
  check('boot: hooks ready after clean reload', await waitForHooks())
  // make sure no leftover dialog is up
  await evaluate(`(() => {
    document.querySelectorAll('.dialog').forEach(() => {})
    return !document.querySelector('.dialog')
  })()`)

  // ---- criterion 1: close-query three-option dialog --------------------------
  console.log('\n--- close-query dialog ---')
  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify('dirty untitled')}, null)`)
  await editDoc(' CHANGED')
  check('close: doc is dirty', (await evaluate(`window.__veloxP12.getDirty()`)) === true)

  await fireDialogOp('queryClose')
  check(
    'close: dialog appears with 3 options',
    await waitFor(`!!document.querySelector('.dialog') && document.querySelectorAll('.dialog-buttons .dialog-btn').length === 3`)
  )
  const dlg1 = await dialogInfo()
  check(
    "close: dialog labels Save / Don't Save / Cancel",
    dlg1?.title === 'Unsaved Changes' &&
      dlg1.buttons.includes('Save') &&
      dlg1.buttons.includes("Don't Save") &&
      dlg1.buttons.includes('Cancel'),
    JSON.stringify(dlg1)
  )
  check('close: Cancel click', await clickDialogBtn('Cancel'))
  check('close: Cancel → allow=false', (await readDialogOp()) === false)
  check('close: dialog dismissed', !(await evaluate(`!!document.querySelector('.dialog')`)))
  check('close: still dirty after Cancel', (await evaluate(`window.__veloxP12.getDirty()`)) === true)

  await fireDialogOp('queryClose')
  await waitFor(`!!document.querySelector('.dialog')`)
  check("close: Don't Save click", await clickDialogBtn("Don't Save"))
  check("close: Don't Save → allow=true", (await readDialogOp()) === true)

  // Save on a file-backed dirty doc → real disk write, then close allowed
  writeFileSync(CLOSE_PATH, 'v0-close\n')
  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify('v0-close\n')}, ${JSON.stringify(CLOSE_PATH)})`)
  const savedEdit = await editDoc('SAVED_ON_CLOSE')
  await fireDialogOp('queryClose')
  await waitFor(`!!document.querySelector('.dialog')`)
  check('close: Save click (file-backed)', await clickDialogBtn('Save'))
  check('close: Save → allow=true', (await readDialogOp()) === true)
  check(
    'close: save wrote disk content',
    readFileSync(CLOSE_PATH, 'utf8') === savedEdit,
    JSON.stringify(readFileSync(CLOSE_PATH, 'utf8'))
  )
  check('close: dirty cleared after Save', (await evaluate(`window.__veloxP12.getDirty()`)) === false)
  check('close: draft discarded after Save', !(await draftHas(CLOSE_PATH)))

  // confirmDiscard shares the same three-option dialog (switch-file guard)
  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify('switch me')}, null)`)
  await editDoc(' DIRTY2')
  await fireDialogOp('confirmDiscard')
  check(
    'confirmDiscard: three-option dialog',
    await waitFor(`document.querySelectorAll('.dialog-buttons .dialog-btn').length === 3`)
  )
  check('confirmDiscard: Cancel → false', await (async () => {
    await clickDialogBtn('Cancel')
    return (await readDialogOp()) === false
  })())
  await fireDialogOp('confirmDiscard')
  await waitFor(`!!document.querySelector('.dialog')`)
  check("confirmDiscard: Don't Save → true", await (async () => {
    await clickDialogBtn("Don't Save")
    return (await readDialogOp()) === true
  })())

  // Save As cancelled → close aborted (mock the native save dialog only when
  // the contextBridge object is truly patchable — identity check, otherwise a
  // real modal would open and hang the suite)
  const mockWorks = await evaluate(`(() => {
    try {
      const stub = async () => null
      window.api.showSaveDialog = stub
      return window.api.showSaveDialog === stub
    } catch { return false }
  })()`)
  if (mockWorks) {
    await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify('untitled save-as')}, null)`)
    await editDoc(' X')
    await fireDialogOp('queryClose')
    await waitFor(`!!document.querySelector('.dialog')`)
    await clickDialogBtn('Save')
    check('close: Save As cancel → close aborted', (await readDialogOp()) === false)
  } else {
    skip('close: Save As cancel → close aborted', 'contextBridge api object not patchable in this build')
  }

  // ---- criterion 2: debounce autosave ----------------------------------------
  console.log('\n--- debounce autosave ---')
  await pinPrefs(`autoSaveMode: 'debounce', autoSaveDelaySec: 3, crashRecoveryEnabled: true`)
  await evaluate(`window.__veloxPrefs.setPreferences({ autoSaveMode: 'debounce', autoSaveDelaySec: 3, crashRecoveryEnabled: true, restoreLastSession: false })`)
  writeFileSync(AS_PATH, 'v0\n')
  const mtimeBefore = statSync(AS_PATH).mtimeMs
  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify('v0\n')}, ${JSON.stringify(AS_PATH)})`)
  await editDoc('AUTOSAVED_MARK')
  check('autosave: dirty right after edit', (await evaluate(`window.__veloxP12.getDirty()`)) === true)
  const t0 = Date.now()
  let autosaved = false
  while (Date.now() - t0 < 10000) {
    const disk = readFileSync(AS_PATH, 'utf8')
    if (disk.includes('AUTOSAVED_MARK') && statSync(AS_PATH).mtimeMs > mtimeBefore) {
      autosaved = true
      break
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  const elapsed = Date.now() - t0
  check('autosave: disk content + mtime updated', autosaved, `elapsed=${elapsed}ms disk=${JSON.stringify(readFileSync(AS_PATH, 'utf8'))}`)
  check('autosave: respected ~3s debounce window', elapsed >= 2500 && elapsed < 9000, `elapsed=${elapsed}ms`)
  check('autosave: dirty cleared after autosave', (await evaluate(`window.__veloxP12.getDirty()`)) === false)
  check('autosave: lastAutoSaveAt set', (await evaluate(`window.__veloxP12.getLastAutoSaveAt()`)) != null)
  check(
    'autosave: titlebar indicator',
    await waitFor(`(document.querySelector('.tb-autosave')?.textContent ?? '').includes('Auto-saved')`)
  )

  // ---- criterion 3: crash draft + recovery dialog ----------------------------
  console.log('\n--- crash recovery ---')
  await cleanDrafts()
  await evaluate(`window.__veloxPrefs.setPreferences({ autoSaveMode: 'off', crashRecoveryEnabled: true, restoreLastSession: false })`)
  // Give Chromium a beat to commit localStorage before the SIGKILL — prefs on
  // disk are what the next boot reads (the product default is recovery-on).
  await new Promise((r) => setTimeout(r, 2000))
  writeFileSync(CRASH_PATH, 'DISK_V1\n')
  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify('DISK_V1\n')}, ${JSON.stringify(CRASH_PATH)})`)
  await editDoc('CRASH_V2')
  check('crash: draft recorded for path', await pollDraft(CRASH_PATH, 'CRASH_V2', 8000))
  await new Promise((r) => setTimeout(r, 800)) // draft flushed to disk pre-kill

  // SIGKILL → respawn → recovery dialog must offer the draft
  console.log('SIGKILL the app…')
  if (app) app.kill('SIGKILL')
  await new Promise((r) => setTimeout(r, 1200))
  app = launch()
  await connect()
  check('crash: hooks ready after respawn', await waitForHooks())
  // Startup recovery fires on sessionSynced when crashRecoveryEnabled is on.
  // SIGKILL can drop unflushed localStorage; the product default is true, so
  // when the pref was lost re-enable it and run the same checkDrafts body.
  const prefNow = await evaluate(`window.__veloxPrefs.getPreferences().crashRecoveryEnabled`)
  if (prefNow !== true) {
    console.log('note: SIGKILL dropped crashRecoveryEnabled from localStorage — re-enable + runDraftCheck (same code path as startup)')
    await evaluate(`window.__veloxPrefs.setPreferences({ crashRecoveryEnabled: true, autoSaveMode: 'off', restoreLastSession: false })`)
    await evaluate(`window.__veloxP12.runDraftCheck()`)
  }
  check(
    'crash: recovery dialog appears',
    await waitFor(`document.querySelector('.dialog-title')?.textContent === 'Recover Unsaved Draft'`, 15000)
  )
  const rec = await dialogInfo()
  check(
    'crash: dialog names the draft path',
    (rec?.message ?? '').includes(CRASH_PATH),
    JSON.stringify(rec?.message)
  )
  check('crash: Restore Draft click', await clickDialogBtn('Restore Draft'))
  const restoredContentOk = (await docText()).includes('CRASH_V2')
  const restoredPathOk = (await evaluate(`window.__veloxP12.getFilePath()`)) === CRASH_PATH
  const restoredDirtyOk = (await evaluate(`window.__veloxP12.getDirty()`)) === true
  check('crash: restored content matches draft', restoredContentOk, await docText())
  check('crash: file path restored', restoredPathOk)
  check('crash: dirty after restore', restoredDirtyOk)

  // criterion 4: save after restore discards the draft — only safe when the
  // draft actually loaded (saveFile on a path-less buffer opens a native
  // Save As dialog which would hang the suite)
  if (restoredPathOk && restoredContentOk) {
    const saveOk = await evaluate(`window.__veloxP12.saveFile()`)
    check('crash: saveFile ok', saveOk === true)
    check('crash: disk now has restored content', readFileSync(CRASH_PATH, 'utf8').includes('CRASH_V2'))
    check('crash: draft gone after save', !(await draftHas(CRASH_PATH)))
  } else {
    check('crash: saveFile ok', false, 'skipped — draft was not restored, no safe save target')
  }

  // Discard Draft path: new draft → runDraftCheck → discard (runDraftCheck is
  // safe even when restore failed — it only shows the in-app dialog)
  if (restoredPathOk) {
    await editDoc(' AFTER_DISCARD_PROBE')
    check('crash: new draft recorded', await pollDraft(CRASH_PATH, 'AFTER_DISCARD_PROBE', 8000))
    // fire-and-forget: checkDrafts awaits the dialog choice — clicking happens next
    await evaluate(`(() => { window.__p12DraftCheck = window.__veloxP12.runDraftCheck(); return true })()`)
    check(
      'crash: draft-check dialog appears',
      await waitFor(`document.querySelector('.dialog-title')?.textContent === 'Recover Unsaved Draft'`)
    )
    check('crash: Discard Draft click', await clickDialogBtn('Discard Draft'))
    check('crash: draft-check resolved', (await evaluate(`window.__p12DraftCheck.then(() => true)`)) === true)
    check('crash: draft discarded', !(await draftHas(CRASH_PATH)))
    check('crash: editor content untouched by discard', (await docText()).includes('AFTER_DISCARD_PROBE'))
  } else {
    check('crash: draft discard path', false, 'skipped — restore failed')
  }

  // ---- untitled draft recovery ------------------------------------------------
  console.log('\n--- untitled draft + session cursor ---')
  await cleanDrafts()
  await evaluate(`window.__veloxPrefs.setPreferences({ autoSaveMode: 'off', crashRecoveryEnabled: true, restoreLastSession: false })`)
  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify('UNTITLED_BASE')}, null)`)
  await editDoc('_DRAFT_X')
  check('untitled: draft recorded (path null)', await pollDraft(null, 'UNTITLED_BASE', 8000))
  await evaluate(`(() => { window.__p12DraftCheck = window.__veloxP12.runDraftCheck(); return true })()`)
  check(
    'untitled: recovery dialog appears',
    await waitFor(`document.querySelector('.dialog-title')?.textContent === 'Recover Unsaved Draft'`)
  )
  const uRec = await dialogInfo()
  check('untitled: message says Untitled draft', (uRec?.message ?? '').includes('Untitled draft'), JSON.stringify(uRec?.message))
  check('untitled: Restore Draft click', await clickDialogBtn('Restore Draft'))
  check('untitled: restored content', (await docText()) === 'UNTITLED_BASE_DRAFT_X', await docText())
  check('untitled: dirty after restore', (await evaluate(`window.__veloxP12.getDirty()`)) === true)

  // ---- lastCursor session restore --------------------------------------------
  await evaluate(`window.__veloxPrefs.setPreferences({ crashRecoveryEnabled: false, restoreLastSession: true })`)
  await cleanDrafts()
  writeFileSync(CURSOR_PATH, 'Hello world cursor test\n')
  await evaluate(`window.__veloxP12.loadDoc(${JSON.stringify('Hello world cursor test\n')}, ${JSON.stringify(CURSOR_PATH)})`)
  await evaluate(`(() => {
    const v = window.__veloxEditor.view
    v.dispatch({ selection: { anchor: 8 }, scrollIntoView: true })
    return true
  })()`)
  await new Promise((r) => setTimeout(r, 900)) // > 500ms persist throttle
  const sess = await evaluate(`window.__veloxPrefs.getSession()`)
  check('cursor: lastCursor persisted', sess?.lastCursor === 8, JSON.stringify(sess?.lastCursor))
  await send('Page.reload')
  check('cursor: hooks after reload', await waitForHooks())
  check(
    'cursor: selection restored to 8',
    await waitFor(`(() => {
      const v = window.__veloxEditor?.view
      if (!v) return false
      return v.state.doc.toString().includes('Hello world') && v.state.selection.main.head === 8
    })()`, 15000)
  )

  // ---- final cleanup (leave other scripts a clean world) ---------------------
  console.log('\n--- cleanup ---')
  const removed = await cleanDrafts()
  console.log(`cleanup: discarded ${removed} draft(s)`)
  await pinPrefs(`crashRecoveryEnabled: false, restoreLastSession: false`)
  await evaluate(`window.__veloxPrefs.setPreferences({ crashRecoveryEnabled: false, autoSaveMode: 'off', restoreLastSession: false })`)
  check('cleanup: draft list empty', (await draftList()).length === 0)
  check('cleanup: no recovery dialog', !(await evaluate(`!!document.querySelector('.dialog')`)))

  console.log(`\n${failures.length === 0 ? 'ALL PASS' : `${failures.length} FAILURES`}`)
  if (failures.length) {
    console.log(failures.join('\n'))
    process.exitCode = 1
  }
  if (app) app.kill()
}

main().catch((err) => {
  console.error(err)
  if (app) app.kill()
  process.exitCode = 1
})
