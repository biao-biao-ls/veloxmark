// CDP smoke + benchmark for P09 (inline fine-grained WYSIWYG).
// Runs against the *built* app (out/) with remote debugging enabled:
//   npm run build
//   node scripts/cdp-p09.mjs [--bench-only] [--label=baseline]
// Launches Electron itself if no target is listening. Drives the real editor
// window.__veloxEditor.view. Bench results land in scripts/tmp-p09/bench-<label>.json.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9226
const CDP = `http://127.0.0.1:${CDP_PORT}`
const TMP = join(ROOT, 'scripts', 'tmp-p09')
const BENCH_ONLY = process.argv.includes('--bench-only')
const LABEL = process.argv.find((a) => a.startsWith('--label='))?.slice(8) ?? 'run'

const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'), // macOS
  join(electronPkg, 'electron.exe'), // Windows
  join(electronPkg, 'electron') // Linux
].find((p) => existsSync(p))

mkdirSync(TMP, { recursive: true })

// ---- functional fixtures (acceptance 1–3 + boundaries) ----------------------

const L1 = 'This is **bold** and *em* text.'
const L2 = 'Here is *a* and **b** together.'
const L3 = 'Empty: **** done.'
const L4 = '- list **strong** item'
const L5 = '# Head *x* y'
const FIXTURE = [L1, L2, L3, L4, L5].join('\n')

/** Absolute doc position of `sub` inside fixture line `lineIdx`. */
function posIn(lineIdx, sub) {
  const lines = FIXTURE.split('\n')
  const start = lines.slice(0, lineIdx).join('\n').length + (lineIdx > 0 ? 1 : 0)
  const col = lines[lineIdx].indexOf(sub)
  if (col < 0) throw new Error(`fixture line ${lineIdx} lacks ${JSON.stringify(sub)}`)
  return start + col
}

const WALK = 'ab **cd** ef'
const WALK_STRONG_FROM = WALK.indexOf('**cd**') // 3
const WALK_STRONG_TO = WALK_STRONG_FROM + '**cd**'.length // 9

// ---- bench fixture (~5k mixed lines) ----------------------------------------

function makeBenchDoc() {
  const parts = ['# P09 Bench', '']
  let lines = 2
  let i = 0
  while (lines < 5000) {
    parts.push(
      `Paragraph ${i} with **bold** and *emphasis* plus \`code${i}\` and [link](https://example.com/${i}) done.`
    )
    parts.push('')
    parts.push(`- list item ${i} with **strong** text`)
    parts.push(`> quote ${i} with *em* text`)
    parts.push('')
    lines += 5
    if (i % 5 === 0) {
      parts.push(`## Section ${i}`)
      parts.push('')
      parts.push(`$$E_${i} = mc^2$$`)
      parts.push('')
      lines += 4
    }
    i++
  }
  return parts.join('\n')
}

// ---- CDP plumbing ------------------------------------------------------------

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
  if (!ELECTRON_BIN) throw new Error('electron binary not found under node_modules/electron/dist')

  let target
  try {
    target = await getTarget(2000)
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

  // Boot: wait for editor, pin prefs so session restore can't clobber the doc, reload.
  check('boot: editor', await waitFor(`!!window.__veloxEditor?.view`, 20000))
  await evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw, restoreLastSession: false, focusMode: false, typewriterMode: false, sourceMode: false
    }))
    localStorage.setItem('veloxmark.session', JSON.stringify({ lastFilePath: null, lastFolderPath: null }))
  })()`)
  await send('Page.reload')
  check('reboot: editor back', await waitFor(`!!window.__veloxEditor?.view`, 20000))

  const setDoc = (text, cursor = 0) =>
    evaluate(`(() => {
      const view = window.__veloxEditor.view
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: ${JSON.stringify(text)} },
        selection: { anchor: ${cursor} },
        scrollIntoView: false
      })
      return view.state.doc.length
    })()`)

  const setCursor = (p) =>
    evaluate(`(() => {
      const view = window.__veloxEditor.view
      view.dispatch({ selection: { anchor: ${p} }, scrollIntoView: false })
      return view.state.selection.main.head
    })()`)

  /** Rendered line texts — hidden (replaced) source is absent from the DOM. */
  const visibleText = () =>
    evaluate(`(() => {
      const lines = [...document.querySelectorAll('.cm-editor .cm-content > .cm-line')]
      return lines.map((l) => l.textContent).join('\\n')
    })()`)

  /** Give the async markdown parser + decoration rebuild time to settle. */
  const settle = async () => {
    await waitFor(`!!window.__veloxEditor?.view`)
    await evaluate(`(() => {
      const view = window.__veloxEditor.view
      const head = view.state.selection.main.head
      for (let i = 0; i < 8; i++) view.dispatch({ selection: { anchor: head }, scrollIntoView: false })
    })()`)
    await new Promise((r) => setTimeout(r, 350))
  }

  if (!BENCH_ONLY) {
    // ---- acceptance 1: cursor inside bold shows both **; other marks stay hidden
    await setDoc(FIXTURE, posIn(0, 'This') + 2)
    await settle()
    let t = await visibleText()
    check('acc1: cursor outside → no source on line', !t.includes('**bold**') && !t.includes('*em*'), t.split('\n')[0])

    await setCursor(posIn(0, 'bo') + 1) // inside "bold"
    await settle()
    t = await visibleText()
    const l1 = t.split('\n')[0] ?? ''
    check('acc1: inside bold → ** visible', l1.includes('**bold**'), l1)
    check('acc1: inside bold → *em* stays hidden (no line flash)', !l1.includes('*em*'), l1)

    // ---- acceptance 2: multiple marks on a line toggle independently
    await setCursor(posIn(1, 'a')) // inside *a*
    await settle()
    t = await visibleText()
    const l2a = t.split('\n')[1] ?? ''
    check('acc2: cursor in *a* → its delimiters visible', l2a.includes('*a*'), l2a)
    check('acc2: cursor in *a* → **b** stays hidden', !l2a.includes('**b**'), l2a)

    await setCursor(posIn(1, 'b')) // inside **b**
    await settle()
    t = await visibleText()
    const l2b = t.split('\n')[1] ?? ''
    check('acc2: cursor in **b** → its delimiters visible', l2b.includes('**b**'), l2b)
    check('acc2: cursor in **b** → *a* stays hidden', !l2b.includes('*a*'), l2b)

    // ---- acceptance 3: per-character walk — no cursor jump, visibility tracks position
    await setDoc(WALK, 0)
    await settle()
    const walkFailures = []
    for (let p = 0; p <= WALK.length; p++) {
      const head = await setCursor(p)
      // one frame for the decoration field rebuild (synchronous in dispatch)
      const text = await visibleText()
      const line = text.split('\n')[0] ?? ''
      const starsVisible = line.includes('**cd**')
      const expectVisible = p >= WALK_STRONG_FROM && p <= WALK_STRONG_TO
      if (head !== p) walkFailures.push(`pos ${p}: head snapped to ${head}`)
      if (starsVisible !== expectVisible)
        walkFailures.push(`pos ${p}: ** visible=${starsVisible}, expected ${expectVisible} [${line}]`)
    }
    check('acc3: walk head never snaps + visibility tracks pos', walkFailures.length === 0,
      walkFailures.slice(0, 4).join(' | '))

    // ---- boundary: empty strong **** — stable, deterministic, no hang
    await setDoc(L3, 0)
    await settle()
    const emptyFrom = L3.indexOf('****')
    let boundaryOk = true
    let boundaryDetail = ''
    try {
      let prev = null
      for (const p of [emptyFrom - 1, emptyFrom, emptyFrom + 1, emptyFrom + 2, emptyFrom + 3, emptyFrom + 4]) {
        await setCursor(p)
        const text = await visibleText()
        // determinism: same position twice → same rendering
        await setCursor(p)
        const text2 = await visibleText()
        if (text !== text2) {
          boundaryOk = false
          boundaryDetail = `pos ${p} oscillates: ${JSON.stringify(text)} vs ${JSON.stringify(text2)}`
          break
        }
        prev = p
      }
    } catch (e) {
      boundaryOk = false
      boundaryDetail = String(e)
    }
    check('boundary: **** empty strong stable, no oscillation', boundaryOk, boundaryDetail)

    // ---- list marks: Typora-grade — hidden in item text, shown on the marker
    // (posIn indexes the full FIXTURE, so the doc must be the full fixture)
    await setDoc(FIXTURE, 0)
    await settle()
    await setCursor(posIn(3, 'list') + 2) // cursor inside item text
    await settle()
    t = await visibleText()
    const l4text = t.split('\n')[3] ?? ''
    check('list: cursor in text → marker hidden', !l4text.startsWith('- '), l4text)
    await setCursor(posIn(3, '-')) // cursor on the marker char
    await settle()
    t = await visibleText()
    const l4mark = t.split('\n')[3] ?? ''
    check('list: cursor on marker → marker visible', l4mark.startsWith('- '), l4mark)

    // ---- headings stay line-granular; inline em inside heading is mark-granular
    await setCursor(posIn(4, 'Head') + 1)
    await settle()
    t = await visibleText()
    const l5 = t.split('\n')[4] ?? ''
    check('heading: cursor on heading line → # visible (line-level)', l5.startsWith('# '), l5)
    check('heading: em delimiters inside heading mark-level (hidden here)', !l5.includes('*x*'), l5)
    await setCursor(0) // cursor off the heading line (onto L1)
    await settle()
    t = await visibleText()
    const l5off = t.split('\n')[4] ?? ''
    check('heading: cursor left heading → # hidden', !l5off.startsWith('#'), l5off)

    // Visual QA shot: cursor inside bold, only that mark's delimiters visible.
    await setDoc(FIXTURE, posIn(0, 'bo') + 1)
    await settle()
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(ROOT, 'scripts', 'p09-marks.png'), Buffer.from(shot.data, 'base64'))
    console.log('saved scripts/p09-marks.png')

    // ---- regression: P08 source mode still disables all live-preview decos
    await evaluate(`(() => {
      const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
      localStorage.setItem('veloxmark.preferences', JSON.stringify({
        ...raw, restoreLastSession: false, focusMode: false, typewriterMode: false, sourceMode: true
      }))
    })()`)
    await send('Page.reload')
    check('regress: reboot for source mode', await waitFor(`!!window.__veloxEditor?.view`, 20000))
    await setDoc(FIXTURE, 0)
    await settle()
    t = await visibleText()
    const decoCount = await evaluate(`document.querySelectorAll('.cm-editor [class*="cm-md-"]').length`)
    check('regress: source mode shows raw ** in DOM text', t.includes('**bold**'), t.split('\n')[0])
    check('regress: source mode zero cm-md-* nodes', decoCount === 0, String(decoCount))
    check('regress: cm-source-mode class on editor root',
      await evaluate(`!!document.querySelector('.cm-editor.cm-source-mode')`))
    // Back to live mode for the block-widget check.
    await evaluate(`(() => {
      const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
      localStorage.setItem('veloxmark.preferences', JSON.stringify({ ...raw, sourceMode: false }))
    })()`)
    await send('Page.reload')
    check('regress: reboot for live mode', await waitFor(`!!window.__veloxEditor?.view`, 20000))

    // ---- regression: fenced code block still block-granular (untouched by P09)
    const CODE = 'before\n\n```js\nconst x = 1\n```\n\nafter\n'
    await setDoc(CODE, 0) // cursor on "before", outside the block
    await settle()
    check('regress: fenced code widget when cursor outside',
      await evaluate(`!!document.querySelector('.cm-editor .cm-md-code-block')`))
    await setCursor(CODE.indexOf('const x') + 3) // cursor inside the code block
    await settle()
    const widgetGone = await evaluate(`!document.querySelector('.cm-editor .cm-md-code-block')`)
    const codeSrcShown = (await visibleText()).includes('const x = 1')
    check('regress: cursor inside code block → source visible', widgetGone && codeSrcShown,
      JSON.stringify({ widgetGone, codeSrcShown }))
  }

  // ---- benchmark: 5k-line doc ------------------------------------------------
  const benchDoc = makeBenchDoc()
  console.log(`\n=== bench (${LABEL}) — ${benchDoc.split('\n').length} lines ===`)
  await setDoc(benchDoc, 0)
  await new Promise((r) => setTimeout(r, 400))

  // Warm up: spread cursor moves across the doc so the async parser advances
  // and JIT warms, then pause so late parse chunks land before measuring.
  await evaluate(`(() => {
    const view = window.__veloxEditor.view
    const len = view.state.doc.length
    for (let round = 0; round < 6; round++) {
      for (let i = 0; i < 40; i++) {
        const pos = Math.floor(((round * 40 + i) / 240) * len)
        view.dispatch({ selection: { anchor: pos }, scrollIntoView: false })
      }
    }
  })()`)
  await new Promise((r) => setTimeout(r, 400))
  await evaluate(`(() => {
    const view = window.__veloxEditor.view
    const len = view.state.doc.length
    for (let i = 0; i < 80; i++) {
      view.dispatch({ selection: { anchor: Math.floor((i / 80) * len) }, scrollIntoView: false })
    }
  })()`)
  await new Promise((r) => setTimeout(r, 200))

  const statsSrc = `(() => {
    const stats = (times) => {
      const s = [...times].sort((a, b) => a - b)
      const q = (f) => s[Math.min(s.length - 1, Math.floor(s.length * f))]
      const avg = s.reduce((a, b) => a + b, 0) / s.length
      return { n: s.length, avg: +avg.toFixed(3), p50: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3), max: +s[s.length - 1].toFixed(3) }
    }
    const view = window.__veloxEditor.view
    const len = view.state.doc.length

    // selection moves at deterministic pseudo-random positions
    let seed = 42
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    const selTimes = []
    for (let i = 0; i < 300; i++) {
      const pos = Math.floor(rand() * len)
      const t0 = performance.now()
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: false })
      selTimes.push(performance.now() - t0)
    }

    // cursor walk through mark-heavy text (P09 hot path)
    const src = view.state.doc.toString()
    const anchor = src.indexOf('with **bold** and *emphasis*')
    const walkTimes = []
    if (anchor >= 0) {
      for (let p = anchor - 2; p < anchor + 40; p++) {
        const t0 = performance.now()
        view.dispatch({ selection: { anchor: p }, scrollIntoView: false })
        walkTimes.push(performance.now() - t0)
      }
    }

    // typing: 100 single-char inserts mid-doc
    view.dispatch({ selection: { anchor: Math.floor(len / 2) }, scrollIntoView: false })
    const typeTimes = []
    for (let i = 0; i < 100; i++) {
      const t0 = performance.now()
      view.dispatch(view.state.replaceSelection('x'), { scrollIntoView: false })
      typeTimes.push(performance.now() - t0)
    }

    return { lines: view.state.doc.lines, sel: stats(selTimes), walk: stats(walkTimes), type: stats(typeTimes) }
  })()`

  const bench = await evaluate(statsSrc)
  console.log(JSON.stringify(bench, null, 2))
  writeFileSync(join(TMP, `bench-${LABEL}.json`), JSON.stringify({ label: LABEL, ...bench }, null, 2))
  console.log(`wrote scripts/tmp-p09/bench-${LABEL}.json`)

  ws.close()
  if (app) app.kill()
  if (BENCH_ONLY) {
    console.log('\nbench-only run complete')
    process.exit(0)
  }
  console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nall checks passed')
  process.exit(failures.length ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  if (app) app.kill()
  process.exit(1)
})
