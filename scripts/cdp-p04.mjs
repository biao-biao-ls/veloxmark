// CDP smoke test for P04 (export PDF / HTML).
// Runs against the *built* app (out/) with remote debugging enabled:
//   npm run build
//   node scripts/cdp-p04.mjs
// Launches Electron itself if no target is listening. Asserts the export
// render pipeline output and drives the real IPC channels (export:html /
// export:pdf) end-to-end against scripts/tmp-p04/.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9224
const CDP = `http://127.0.0.1:${CDP_PORT}`
const ELECTRON_BIN = join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
const TMP = join(ROOT, 'scripts', 'tmp-p04')
const OUT_HTML = join(TMP, 'out.html')
const OUT_PDF = join(TMP, 'out.pdf')

mkdirSync(TMP, { recursive: true })

// Self-contained fixture: written on first run so the tmp workspace needs
// nothing committed (P03 convention — scripts/tmp-* stays gitignored).
const FIXTURE_PATH = join(TMP, 'fixture.md')
if (!existsSync(FIXTURE_PATH)) {
  writeFileSync(
    FIXTURE_PATH,
    [
      '# P04 Export Fixture',
      '',
      'Some **bold**, *italic*, ~~strikethrough~~, `inline code`, and a [link](https://example.com).',
      '',
      '## Code',
      '',
      '```js',
      'function hello(name) {',
      '  return `Hello, ${name}!`',
      '}',
      '```',
      '',
      '## Math',
      '',
      'Inline math $E = mc^2$ and a block:',
      '',
      '$$',
      '\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}',
      '$$',
      '',
      '## Mermaid',
      '',
      '```mermaid',
      'graph TD',
      '  A[Markdown] --> B{Export}',
      '  B -->|PDF| C[printToPDF]',
      '  B -->|HTML| D[self-contained]',
      '```',
      '',
      '## Table',
      '',
      '| Feature | Status | Notes |',
      '|:--------|:------:|------:|',
      '| PDF | done | printToPDF |',
      '| HTML | done | inline CSS |',
      '',
      '## Lists',
      '',
      '- [x] render pipeline',
      '- [ ] world domination',
      '  - nested item',
      '- plain item',
      '',
      '1. first',
      '2. second',
      '',
      '> A blockquote with *style*.',
      '',
      '---',
      '',
      '![fixture image](fixture.png)',
      ''
    ].join('\n')
  )
  // 1×1 red PNG — enough to prove data-URL embedding.
  writeFileSync(
    join(TMP, 'fixture.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
  )
}
const FIXTURE = readFileSync(FIXTURE_PATH, 'utf-8')

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

  // Wait for the export handle (renderer registers it on module load).
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    if ((await evaluate('typeof window.__veloxExport')) === 'object') break
    await new Promise((r) => setTimeout(r, 500))
  }

  const failures = []
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`)
    if (!ok) failures.push(name)
  }

  // ---- render pipeline --------------------------------------------------------
  const html = await evaluate(
    `window.__veloxExport.renderHtml(${JSON.stringify(FIXTURE)}, { baseDir: ${JSON.stringify(TMP)}, theme: 'light', imageMode: 'embed', katexFonts: 'embed' })`
  )
  check('html rendered', typeof html === 'string' && html.length > 5000, String(html?.length))
  check('heading rendered', html.includes('<h1>P04 Export Fixture</h1>'))
  check('hljs highlighted', html.includes('class="hljs"') && html.includes('hljs-'))
  check('katex block', html.includes('katex-display'))
  check('katex inline', (html.match(/class="katex"/g) ?? []).length >= 2)
  check('mermaid inline svg', html.includes('export-mermaid') && /<svg[^>]*>/.test(html))
  check('table alignment', html.includes('text-align:center') && html.includes('text-align:right'))
  check('task checkbox', html.includes('type="checkbox" disabled checked'))
  check('task marker not leaked', !html.includes('[x] render'))
  check('link href without url text leak', html.includes('<a href="https://example.com">link</a>'))
  check('nested list', html.includes('<ul>') && html.includes('<ol'))
  check('image embedded', html.includes('data:image/png;base64,'))
  check('no external css links', !/<link[^>]+href="http/.test(html))
  check('katex fonts inlined', html.includes('data:font/woff2;base64'))
  check('woff/ttf fallbacks stripped', !/format\("truetype"\)/.test(html))
  check('hljs theme scoped', html.includes('.export-theme-light .hljs'))
  check('theme class', html.includes('export-theme-light'))

  // Force-light on dark: mermaid/hljs must come back light.
  const smallMd = '# x\n\n```js\nconst a = 1\n```\n'
  const forced = await evaluate(
    `window.__veloxExport.renderHtml(${JSON.stringify(smallMd)}, { theme: 'dark', imageMode: 'embed', katexFonts: 'embed' })`
  )
  check('dark theme class', forced.includes('export-theme-dark'))
  check('dark hljs theme', forced.includes('.export-theme-dark .hljs'))

  // Relative image mode keeps the markdown src verbatim.
  const rel = await evaluate(
    `window.__veloxExport.renderHtml('![x](fixture.png)\\n', { baseDir: ${JSON.stringify(TMP)}, theme: 'light', imageMode: 'relative', katexFonts: 'embed' })`
  )
  check('relative image src', rel.includes('src="fixture.png"'))

  // ---- IPC: export:html -------------------------------------------------------
  const htmlOk = await evaluate(`(async () => {
    const html = await window.__veloxExport.renderHtml(${JSON.stringify(FIXTURE)}, { baseDir: ${JSON.stringify(TMP)}, theme: 'light' })
    return window.api.exportHtml(${JSON.stringify(OUT_HTML)}, html)
  })()`)
  check('export:html wrote file', htmlOk === true && existsSync(OUT_HTML))
  if (existsSync(OUT_HTML)) {
    const written = readFileSync(OUT_HTML, 'utf-8')
    check('written html self-contained', written.startsWith('<!DOCTYPE html>') && written.includes('data:font/woff2;base64'))
  }

  // ---- IPC: export:pdf --------------------------------------------------------
  const pdfOk = await evaluate(`(async () => {
    const html = await window.__veloxExport.renderHtml(${JSON.stringify(FIXTURE)}, { baseDir: ${JSON.stringify(TMP)}, theme: 'light' })
    return window.api.exportPdf(${JSON.stringify(OUT_PDF)}, html, {
      pageSize: 'A4', margins: 'normal', headerFooter: true, title: 'fixture'
    })
  })()`)
  check('export:pdf wrote file', pdfOk === true && existsSync(OUT_PDF))
  if (existsSync(OUT_PDF)) {
    const buf = readFileSync(OUT_PDF)
    check('pdf magic bytes', buf.subarray(0, 5).toString() === '%PDF-')
    check('pdf non-trivial size', statSync(OUT_PDF).size > 20_000, `${statSync(OUT_PDF).size} bytes`)
    check('pdf has pages', buf.includes('/Type /Page') || buf.includes('/Type/Page'))
  }

  // ---- UI: File ▸ Export submenu + dialogs ------------------------------------
  // React re-renders asynchronously after each click — poll instead of racing.
  await evaluate(`(() => { [...document.querySelectorAll('.menubar-label')].find(b => b.textContent.trim() === 'File')?.click() })()`)
  const waitFor = async (expr, ms = 5000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (await evaluate(expr)) return true
      await new Promise((r) => setTimeout(r, 100))
    }
    return false
  }
  check('File menu opens', await waitFor(`document.querySelectorAll('.menu-dropdown').length > 0`))
  const exportSub = await evaluate(`(() => {
    for (const h of document.querySelectorAll('.menu-sub-host')) {
      const kids = [...h.querySelectorAll('.menu-sub .menu-item')]
      if (kids.some((k) => k.textContent.includes('PDF'))) return kids.map((k) => k.textContent.trim())
    }
    return null
  })()`)
  check('Export submenu PDF/HTML', !!exportSub && exportSub.some((k) => k.includes('PDF')) && exportSub.some((k) => k.includes('HTML')), JSON.stringify(exportSub))

  // Open the PDF dialog (skip disabled items — Open Recent's greyed entries).
  await evaluate(`(() => {
    for (const h of document.querySelectorAll('.menu-sub-host')) {
      const btn = [...h.querySelectorAll('.menu-sub .menu-item')].find((k) => k.textContent.includes('PDF') && !k.disabled)
      if (btn) { btn.click(); return true }
    }
    return false
  })()`)
  const pdfDialog = await waitFor(`document.querySelector('.dialog[aria-label="Export PDF"]') !== null`)
  check('PDF dialog opens', pdfDialog)
  if (pdfDialog) {
    const rows = await evaluate(`[...document.querySelectorAll('.dialog[aria-label="Export PDF"] .prefs-label')].map((l) => l.textContent)`)
    check('PDF options present', rows.includes('Paper size') && rows.includes('Margins') && rows.includes('Theme'), JSON.stringify(rows))
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(TMP, 'dialog-pdf.png'), Buffer.from(shot.data, 'base64'))
    console.log('saved', join(TMP, 'dialog-pdf.png'))
    await evaluate(`[...document.querySelectorAll('.dialog[aria-label="Export PDF"] .dialog-btn')].find((b) => b.textContent === 'Cancel')?.click()`)
  }

  // Reopen the File menu for the HTML path.
  await evaluate(`(() => {
    const labels = [...document.querySelectorAll('.menubar-label')];
    labels.find((b) => b.textContent.trim() === 'File')?.click();
  })()`)
  await waitFor(`document.querySelectorAll('.menu-dropdown').length > 0`)
  await evaluate(`(() => {
    for (const h of document.querySelectorAll('.menu-sub-host')) {
      const btn = [...h.querySelectorAll('.menu-sub .menu-item')].find((k) => k.textContent.includes('HTML') && !k.disabled)
      if (btn) { btn.click(); return true }
    }
    return false
  })()`)
  const htmlDialog = await waitFor(`document.querySelector('.dialog[aria-label="Export HTML"]') !== null`)
  check('HTML dialog opens', htmlDialog)
  if (htmlDialog) {
    const rows = await evaluate(`[...document.querySelectorAll('.dialog[aria-label="Export HTML"] .prefs-label')].map((l) => l.textContent)`)
    check('HTML options present', rows.includes('Images') && rows.includes('KaTeX fonts'), JSON.stringify(rows))
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(TMP, 'dialog-html.png'), Buffer.from(shot.data, 'base64'))
    console.log('saved', join(TMP, 'dialog-html.png'))
    await evaluate(`[...document.querySelectorAll('.dialog[aria-label="Export HTML"] .dialog-btn')].find((b) => b.textContent === 'Cancel')?.click()`)
  }

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
