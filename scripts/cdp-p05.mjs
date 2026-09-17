// CDP smoke test for P05 (image paste/drop, resize, cache invalidation).
// Runs against the *built* app (out/) with remote debugging enabled:
//   npm run build
//   node scripts/cdp-p05.mjs
// Launches Electron itself if no target is listening. Drives the real IPC
// channels and the live editor (window.__veloxEditor) against scripts/tmp-p05/.
//
// Bitmap-clipboard paste (screenshot Ctrl+V) is NOT covered here — synthesizing
// a native image clipboard over CDP is unreliable; that path is manual QA.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9224
const CDP = `http://127.0.0.1:${CDP_PORT}`
const ELECTRON_BIN = join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
const TMP = join(ROOT, 'scripts', 'tmp-p05')
const OUTSIDE = join(ROOT, 'scripts', 'tmp-p05-outside')
const FIXTURE_PATH = join(TMP, 'fixture.md')

// 1×1 PNGs (red / blue) — enough to assert rendering, mtime and re-encoding.
const PNG_RED =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const PNG_BLUE =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

mkdirSync(TMP, { recursive: true })
mkdirSync(OUTSIDE, { recursive: true })
writeFileSync(
  FIXTURE_PATH,
  [
    '# P05 Image Fixture',
    '',
    '![ok](fixture.png)',
    '',
    '![sized](fixture.png =64x32)',
    '',
    '![missing](nope.png)',
    ''
  ].join('\n')
)
writeFileSync(join(TMP, 'fixture.png'), Buffer.from(PNG_RED, 'base64'))
writeFileSync(join(OUTSIDE, 'outside.png'), Buffer.from(PNG_BLUE, 'base64'))

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

async function main() {
  let target
  try {
    target = await getTarget(3000)
  } catch {
    console.log('no app on port', CDP_PORT, '- launching electron…')
    app = spawn(ELECTRON_BIN, ['.', `--remote-debugging-port=${CDP_PORT}`], {
      cwd: ROOT,
      stdio: 'ignore',
      windowsHide: true,
      shell: false
    })
    target = await getTarget(30000)
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', reject)
  })

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

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id
      pending.set(msgId, { resolve, reject })
      ws.send(JSON.stringify({ id: msgId, method, params }))
    })

  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }

  const waitFor = async (expr, ms = 8000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (await evaluate(expr)) return true
      await new Promise((r) => setTimeout(r, 150))
    }
    return false
  }

  const failures = []
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`)
    if (!ok) failures.push(name)
  }

  // Wait for boot, then seed the session so restore opens the fixture with a
  // folder workspace (watcher active for the image:changed test).
  check('boot: window.api', await waitFor(`!!window.api`))
  check('boot: editor', await waitFor(`!!window.__veloxEditor?.view`))
  await evaluate(`(() => {
    localStorage.setItem('veloxmark.session', JSON.stringify({
      lastFilePath: ${JSON.stringify(FIXTURE_PATH)},
      lastFolderPath: ${JSON.stringify(TMP)}
    }))
  })()`)
  await send('Page.reload')
  check('restore: fixture loaded', await waitFor(
    `window.__veloxEditor?.view?.state.doc.toString().includes('P05 Image Fixture') ?? false`,
    15000
  ))

  // ---- rendering ---------------------------------------------------------------
  check('image renders (mdres + mtime version)', await waitFor(`
    [...document.querySelectorAll('.cm-md-image')].some(i =>
      i.src.startsWith('mdres://image') && /[?&]v=\\d+/.test(i.src))
  `))
  const sized = await evaluate(`(() => {
    const img = [...document.querySelectorAll('.cm-md-image')].find(i => i.style.width === '64px')
    return img ? { w: img.style.width, h: img.style.height } : null
  })()`)
  check('=WxH applied to widget', sized?.w === '64px' && sized?.h === '32px', JSON.stringify(sized))
  check('missing image placeholder', await waitFor(`
    [...document.querySelectorAll('.cm-md-image-placeholder')].some(p => p.textContent.includes('missing'))
  `))

  // ---- resolveImageSrc IPC ------------------------------------------------------
  const resolved = await evaluate(
    `window.api.resolveImageSrc(${JSON.stringify(TMP)}, 'fixture.png')`
  )
  check(
    'resolveImageSrc mtime + absPath',
    typeof resolved?.mtime === 'number' && resolved.mtime > 0 && resolved.absPath?.endsWith('fixture.png'),
    JSON.stringify(resolved)
  )
  const missingResolved = await evaluate(
    `window.api.resolveImageSrc(${JSON.stringify(TMP)}, 'nope.png')`
  )
  check('resolveImageSrc missing file', missingResolved?.mtime === null && missingResolved.absPath?.endsWith('nope.png'))

  // ---- importLocalImage IPC -----------------------------------------------------
  const opts = `{ assetsDirName: 'assets', renameMode: 'timestamp', copyExternal: true }`
  const inside = await evaluate(
    `window.api.importLocalImage(${JSON.stringify(TMP)}, ${JSON.stringify(join(TMP, 'fixture.png'))}, ${opts})`
  )
  check('import inside doc dir → relative', inside === 'fixture.png', String(inside))
  const copied = await evaluate(
    `window.api.importLocalImage(${JSON.stringify(TMP)}, ${JSON.stringify(join(OUTSIDE, 'outside.png'))}, ${opts})`
  )
  check(
    'import outside → copied into assets',
    typeof copied === 'string' && /^assets\/img-\d{8}-\d{6}(-\d+)?\.png$/.test(copied) && existsSync(join(TMP, copied)),
    String(copied)
  )
  const absolute = await evaluate(
    `window.api.importLocalImage(${JSON.stringify(TMP)}, ${JSON.stringify(join(OUTSIDE, 'outside.png'))}, { ...${opts}, copyExternal: false })`
  )
  check('import outside, copy off → absolute', absolute === join(OUTSIDE, 'outside.png'), String(absolute))

  // ---- clipboard probes (no bitmap in a CI-ish clipboard) -----------------------
  check('clipboardHasImage false', (await evaluate(`window.api.clipboardHasImage()`)) === false)
  check(
    'saveClipboardImage empty → null',
    (await evaluate(`window.api.saveClipboardImage(${JSON.stringify(TMP)}, ${opts})`)) === null
  )

  // ---- resize via the zoom toolbar ----------------------------------------------
  await evaluate(`(() => {
    const img = [...document.querySelectorAll('.cm-md-image')].find(i => !i.style.width)
    img.scrollIntoView({ block: 'center' })
    img.click()
  })()`)
  check('toolbar opens on click', await waitFor(`!!document.querySelector('.cm-md-image-toolbar')`))
  const shot1 = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(TMP, 'p05-toolbar.png'), Buffer.from(shot1.data, 'base64'))
  console.log('saved', join(TMP, 'p05-toolbar.png'))

  await evaluate(`(() => {
    const slider = document.querySelector('.cm-md-image-toolbar input[type=range]')
    slider.disabled = false
    slider.value = '200'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    slider.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
  // natural size is 1×1 → 200% writes =2x2
  check('slider writes =WxH to source', await waitFor(
    `window.__veloxEditor.view.state.doc.toString().includes('=2x2')`
  ))

  // ---- flip toggles write {flip=…} and apply the transform live ------------------
  await evaluate(`(() => {
    const wrap = document.querySelector('.cm-md-image-wrap.cm-md-image-selected')
    ;[...wrap.querySelectorAll('.cm-md-image-toolbar-btn')].find(b => b.title === 'Flip horizontally').click()
  })()`)
  check('flip-h writes {flip=h}', await waitFor(
    `window.__veloxEditor.view.state.doc.toString().includes('{flip=h}')`
  ))
  check(
    'flip-h applies scaleX(-1)',
    (await evaluate(`
      document.querySelector('.cm-md-image-wrap.cm-md-image-selected img')?.style.transform ?? ''
    `)) === 'scaleX(-1)'
  )
  await evaluate(`(() => {
    const wrap = document.querySelector('.cm-md-image-wrap.cm-md-image-selected')
    ;[...wrap.querySelectorAll('.cm-md-image-toolbar-btn')].find(b => b.title === 'Flip vertically').click()
  })()`)
  check('flip-hv composes to {flip=hv}', await waitFor(
    `window.__veloxEditor.view.state.doc.toString().includes('{flip=hv}')`
  ))

  // ---- save + reopen keeps the size ---------------------------------------------
  await evaluate(`window.api.writeFile(${JSON.stringify(FIXTURE_PATH)}, window.__veloxEditor.view.state.doc.toString())`)
  await send('Page.reload')
  check('reopen: fixture restored', await waitFor(
    `window.__veloxEditor?.view?.state.doc.toString().includes('=2x2') ?? false`,
    15000
  ))
  check('reopen: size kept on widget', await waitFor(`
    [...document.querySelectorAll('.cm-md-image')].some(i => i.style.width === '2px')
  `))
  check('reopen: flip transform kept on widget', await waitFor(`
    [...document.querySelectorAll('.cm-md-image')].some(i => i.style.transform.includes('scaleX(-1)') && i.style.transform.includes('scaleY(-1)'))
  `))

  // ---- watcher invalidation ------------------------------------------------------
  const srcBefore = await evaluate(`
    [...document.querySelectorAll('.cm-md-image')].find(i => i.src.includes('v='))?.src ?? ''
  `)
  // Overwrite the PNG (different bytes + mtime); the folder watcher must
  // broadcast image:changed, the renderer must re-resolve with a new v=.
  writeFileSync(join(TMP, 'fixture.png'), Buffer.from(PNG_BLUE, 'base64'))
  const changed = await waitFor(`(() => {
    const img = [...document.querySelectorAll('.cm-md-image')].find(i => i.src.includes('fixture.png'))
    return !!img && img.src !== ${JSON.stringify(srcBefore)}
  })()`, 8000)
  check('external overwrite refreshes image (watcher)', changed)

  // ---- paste of a local file path (DOM handler) ----------------------------------
  await evaluate(`(() => {
    const view = window.__veloxEditor.view
    view.dispatch({ selection: { anchor: view.state.doc.length } })
    const dt = new DataTransfer()
    dt.setData('text/plain', ${JSON.stringify(join(OUTSIDE, 'outside.png'))})
    view.contentDOM.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })()`)
  check('paste local path inserts assets ref', await waitFor(
    `/!\\[\\]\\(assets\\/img-\\d{8}-\\d{6}/.test(window.__veloxEditor.view.state.doc.toString())`
  ))
  // Regression: a pasted image leaves the cursor at the node end — the widget
  // must stay rendered (clickable), not collapse to source.
  check('pasted image renders widget with cursor at end', await waitFor(`
    (() => {
      const view = window.__veloxEditor.view
      const head = view.state.selection.main.head
      return [...document.querySelectorAll('.cm-md-image-wrap')].some((w) => {
        const r = w.getBoundingClientRect()
        return r.width > 0 && head >= view.state.doc.length - 2
      })
    })()
  `))

  // ---- drop of a remote image URL (kept as URL by default) -----------------------
  await evaluate(`(() => {
    const view = window.__veloxEditor.view
    const dt = new DataTransfer()
    dt.setData('text/uri-list', 'https://example.com/pic.png')
    dt.setData('text/plain', 'https://example.com/pic.png')
    const ev = new DragEvent('drop', { clipboardData: dt, dataTransfer: dt, bubbles: true, cancelable: true, clientX: 0, clientY: 0 })
    view.contentDOM.dispatchEvent(ev)
  })()`)
  check('drop remote URL inserts URL', await waitFor(
    `window.__veloxEditor.view.state.doc.toString().includes('![](https://example.com/pic.png)')`
  ))

  // ---- export keeps the =WxH size ------------------------------------------------
  const exported = await evaluate(
    `window.__veloxExport.renderHtml('![s](fixture.png =64x32)\\n', { baseDir: ${JSON.stringify(TMP)}, theme: 'light', imageMode: 'embed', katexFonts: 'embed' })`
  )
  check(
    'export emits width/height',
    exported.includes('width="64"') && exported.includes('height="32"'),
    String(exported).slice(0, 200)
  )

  // ---- export keeps the flip transform ------------------------------------------
  const exportedFlip = await evaluate(
    `window.__veloxExport.renderHtml('![s](fixture.png =64x32){flip=hv}\\n', { baseDir: ${JSON.stringify(TMP)}, theme: 'light', imageMode: 'embed', katexFonts: 'embed' })`
  )
  check(
    'export emits flip transform',
    exportedFlip.includes('transform:scaleX(-1) scaleY(-1)'),
    String(exportedFlip).slice(0, 300)
  )

  ws.close()
  if (app) app.kill()
  console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nall checks passed')
  process.exit(failures.length ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  if (app) app.kill()
  process.exit(1)
})
