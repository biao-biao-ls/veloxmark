// CDP smoke test for P06 (block widget hover toolbar + refined click-to-source).
// Runs against the *built* app (out/) with remote debugging enabled:
//   npm run build
//   node scripts/cdp-p06.mjs
// Launches Electron itself if no target is listening. Drives the real editor
// (window.__veloxEditor) and the clipboard IPC bridge against scripts/tmp-p06/.
//
// Text selection is verified with real CDP mouse drags: synthetic
// dispatchEvent cannot prove mousedown's default action survived.
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9224
const CDP = `http://127.0.0.1:${CDP_PORT}`
const ELECTRON_BIN = join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
const TMP = join(ROOT, 'scripts', 'tmp-p06')
const FIXTURE_PATH = join(TMP, 'fixture.md')

const CODE = 'const answer = 42\nconsole.log(answer)'
const TEX = 'E = mc^2'
const MERMAID = 'graph TD;\n  A-->B;'
const TABLE = ['| Name | Qty |', '| ---- | --- |', '| a    | 1   |'].join('\n')

mkdirSync(TMP, { recursive: true })
writeFileSync(
  FIXTURE_PATH,
  ['# P06 Fixture', '', '```js', CODE, '```', '', `$$${TEX}$$`, '', '```mermaid', MERMAID, '```', '', TABLE, ''].join(
    '\n'
  )
)

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

  // Boot, seed the session so restore opens the fixture, reload.
  check('boot: window.api', await waitFor(`!!window.api`))
  check('boot: editor', await waitFor(`!!window.__veloxEditor?.view`))
  // P12 hygiene: disable autosave/crash-recovery so draft dialogs never
  // interfere with the widget-toolbar checks.
  await evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw, language: 'en', crashRecoveryEnabled: false, autoSaveMode: 'off'
    }))
  })()`)
  try {
    const drafts = await evaluate(`window.api.draftList()`)
    for (const d of drafts ?? []) {
      await evaluate(`window.api.draftDiscard(${JSON.stringify(d.path)})`)
    }
  } catch { /* drafts API unavailable — nothing to clean */ }
  const seeded = await (async () => {
    for (let i = 0; i < 20; i++) {
      await evaluate(`(() => {
        localStorage.setItem('veloxmark.session', JSON.stringify({
          lastFilePath: ${JSON.stringify(FIXTURE_PATH)},
          lastFolderPath: ${JSON.stringify(TMP)}
        }))
      })()`)
      await new Promise((r) => setTimeout(r, 250))
      const cur = await evaluate(`(() => {
        try { return JSON.parse(localStorage.getItem('veloxmark.session') ?? '{}').lastFilePath ?? null }
        catch { return null }
      })()`)
      if (cur === FIXTURE_PATH) return true
    }
    return false
  })()
  check('session seed persisted', seeded)
  await send('Page.reload')
  check('restore: fixture loaded', await waitFor(
    `window.__veloxEditor?.view?.state.doc.toString().includes('P06 Fixture') ?? false`,
    15000
  ))

  // ---- toolbars exist on every block widget ----------------------------------
  check('code block toolbar', await waitFor(
    `!!document.querySelector('.cm-md-code-block .cm-md-block-toolbar')`))
  check('math block toolbar', await waitFor(
    `!!document.querySelector('.cm-md-math-block .cm-md-block-toolbar')`))
  check('mermaid toolbar (Copy + SVG)', await waitFor(`(() => {
    const bar = document.querySelector('.cm-md-mermaid .cm-md-block-toolbar')
    if (!bar) return false
    const labels = [...bar.querySelectorAll('button')].map((b) => b.textContent)
    return labels.includes('Copy') && labels.includes('SVG')
  })()`))
  check('table toolbar', await waitFor(
    `!!document.querySelector('.cm-md-table-wrap .cm-md-block-toolbar')`))
  check('code lang label kept', await waitFor(
    `document.querySelector('.cm-md-code-block .cm-md-code-lang')?.textContent === 'js'`))
  check('old mermaid-export button gone',
    (await evaluate(`document.querySelectorAll('.cm-md-mermaid-export').length`)) === 0)

  // Hover: toolbar hidden by default, shown on parent hover (real mouse move —
  // :hover is driven by the compositor, synthetic events don't set it). Park
  // the pointer in a corner first so no leftover hover is stuck on the block.
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1, button: 'none' })
  await new Promise((r) => setTimeout(r, 200))
  const codeRect = await evaluate(`(() => {
    const el = document.querySelector('.cm-md-code-block')
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  check('toolbar hidden without hover', (await evaluate(`
    getComputedStyle(document.querySelector('.cm-md-code-block .cm-md-block-toolbar')).opacity
  `)) === '0')
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: codeRect.x,
    y: codeRect.y,
    button: 'none'
  })
  check('toolbar visible on hover', await waitFor(`
    getComputedStyle(document.querySelector('.cm-md-code-block .cm-md-block-toolbar')).opacity === '1'
  `, 3000))

  // Dark theme screenshot for contrast QA.
  await evaluate(`document.documentElement.classList.add('theme-dark')`)
  await new Promise((r) => setTimeout(r, 200))
  const darkShot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(ROOT, 'scripts', 'p06-dark.png'), Buffer.from(darkShot.data, 'base64'))
  console.log('saved scripts/p06-dark.png')
  await evaluate(`document.documentElement.classList.remove('theme-dark')`)

  // ---- Copy buttons write the raw source to the clipboard ----------------------
  // Click via real CDP input at the button's center.
  const clickButton = async (selector) => {
    const rect = await evaluate(`(() => {
      const btn = document.querySelector(${JSON.stringify(selector)})
      if (!btn) return null
      btn.scrollIntoView({ block: 'center' })
      const r = btn.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })()`)
    if (!rect) return false
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1
    })
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1
    })
    return true
  }

  check('code Copy clickable', await clickButton('.cm-md-code-block .cm-md-block-toolbar-btn'))
  await new Promise((r) => setTimeout(r, 300))
  check('code Copy → clipboard == raw code',
    (await evaluate(`window.api.clipboardRead()`)) === CODE)
  check('code Copy flashes ✓', await waitFor(`
    document.querySelector('.cm-md-code-block .cm-md-block-toolbar-btn')?.textContent === '✓'
  `, 2000))
  check('✓ reverts to Copy', await waitFor(`
    document.querySelector('.cm-md-code-block .cm-md-block-toolbar-btn')?.textContent === 'Copy'
  `, 3000))

  check('math Copy clickable', await clickButton('.cm-md-math-block .cm-md-block-toolbar-btn'))
  await new Promise((r) => setTimeout(r, 300))
  check('math Copy → clipboard == TeX',
    (await evaluate(`window.api.clipboardRead()`)) === TEX)

  check('mermaid Copy clickable', await clickButton('.cm-md-mermaid .cm-md-block-toolbar-btn'))
  await new Promise((r) => setTimeout(r, 300))
  check('mermaid Copy → clipboard == source',
    (await evaluate(`window.api.clipboardRead()`)) === MERMAID)

  check('table Copy clickable', await clickButton('.cm-md-table-wrap .cm-md-block-toolbar-btn'))
  await new Promise((r) => setTimeout(r, 300))
  check('table Copy → clipboard == markdown',
    (await evaluate(`window.api.clipboardRead()`)) === TABLE)

  // ---- toolbar clicks must NOT jump to source ---------------------------------
  check('widget still rendered after toolbar clicks', await waitFor(`
    !!document.querySelector('.cm-md-code-block') &&
    !!document.querySelector('.cm-md-table-wrap table')
  `))

  // ---- click inside rendered content jumps to source --------------------------
  // Native selection inside a block widget is impossible (contenteditable=false
  // host; CM's DOMObserver maps any in-widget caret back into the doc), so a
  // content hit is not a dead end — it jumps to the source like a padding hit.
  // Copying rendered content is the toolbar Copy button's job (asserted above).
  const codeInner = await evaluate(`(() => {
    const codeEl = document.querySelector('.cm-md-code-block code')
    codeEl.scrollIntoView({ block: 'center' })
    const r = codeEl.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: codeInner.x, y: codeInner.y, button: 'left', buttons: 1, clickCount: 1
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: codeInner.x, y: codeInner.y, button: 'left', buttons: 1, clickCount: 1
  })
  check('click inside code content jumps to source', await waitFor(`(() => {
    const view = window.__veloxEditor.view
    return !document.querySelector('.cm-md-code-block') &&
      view.state.doc.toString().slice(view.state.selection.main.head, view.state.selection.main.head + 3) === '\`\`\`'
  })()`, 3000))

  // Same for a table cell — the table element fills the whole wrap, so cells
  // ARE the table's click target; without this the table can never be edited.
  const cellRect = await evaluate(`(() => {
    const td = document.querySelector('.cm-md-table tbody td')
    td.scrollIntoView({ block: 'center' })
    const r = td.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: cellRect.x, y: cellRect.y, button: 'left', buttons: 1, clickCount: 1
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: cellRect.x, y: cellRect.y, button: 'left', buttons: 1, clickCount: 1
  })
  check('click on table cell jumps to source', await waitFor(`
    !document.querySelector('.cm-md-table-wrap table')
  `, 3000))

  // ---- click on block padding still jumps to source ---------------------------
  // Use the code block's bottom padding strip (inside the container, outside pre).
  const pad = await evaluate(`(() => {
    const block = document.querySelector('.cm-md-code-block')
    block.scrollIntoView({ block: 'center' })
    const pre = block.querySelector('pre')
    const br = block.getBoundingClientRect()
    const pr = pre.getBoundingClientRect()
    // x inside the block's horizontal padding band (left of pre content).
    return { x: br.x + 2, y: pr.y + pr.height / 2, preLeft: pr.x, blockLeft: br.x }
  })()`)
  // The code block has no horizontal padding (pre fills it), so click the
  // lang label strip — it is container chrome, not pre/code content.
  const langRect = await evaluate(`(() => {
    const label = document.querySelector('.cm-md-code-block .cm-md-code-lang')
    const r = label.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: langRect.x, y: langRect.y, button: 'left', buttons: 1, clickCount: 1
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: langRect.x, y: langRect.y, button: 'left', buttons: 1, clickCount: 1
  })
  check('click on code chrome jumps to source', await waitFor(`(() => {
    const view = window.__veloxEditor.view
    const head = view.state.selection.main.head
    const doc = view.state.doc.toString()
    return !document.querySelector('.cm-md-code-block') && doc.slice(head, head + 3) === '\`\`\`'
  })()`, 3000), await evaluate(`(() => {
    const view = window.__veloxEditor.view
    return JSON.stringify({
      head: view.state.selection.main.head,
      hasBlock: !!document.querySelector('.cm-md-code-block'),
      around: view.state.doc.slice(Math.max(0, view.state.selection.main.head - 2), view.state.selection.main.head + 5)
    })
  })()`))

  // Table: click the wrap's margin area (tables have no cell padding outside
  // the table element — use the wrap's left edge beyond the table when the
  // table is narrower, else skip to the wrap bottom). Fallback: math block
  // side padding always exists (padding: 8px 0 with centered content).
  const mathPad = await evaluate(`(() => {
    const el = document.querySelector('.cm-md-math-block')
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    const katex = el.querySelector('.katex')
    const kr = katex?.getBoundingClientRect()
    // Click left of the centered KaTeX content, inside the block's own box.
    const x = kr ? kr.x - 12 : r.x + 4
    return { x: Math.max(r.x + 2, x), y: r.y + r.height / 2 }
  })()`)
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: mathPad.x, y: mathPad.y, button: 'left', buttons: 1, clickCount: 1
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: mathPad.x, y: mathPad.y, button: 'left', buttons: 1, clickCount: 1
  })
  check('click on math padding jumps to source', await waitFor(`
    !document.querySelector('.cm-md-math-block')
  `, 3000))

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
