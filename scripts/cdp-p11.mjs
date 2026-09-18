// CDP smoke test for P11 (extended syntax: front matter / footnotes /
// highlight / pandoc sub-sup / abbr / definition lists / inline attrs).
// Runs against the *built* app (out/) with remote debugging enabled:
//   npm run build
//   node scripts/cdp-p11.mjs
// Launches Electron itself if no target is listening. Drives the real editor
// via window.__veloxEditor.view + pure parsers via window.__veloxExtended +
// export pipeline via window.__veloxExport.renderHtml.
import { existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CDP_PORT = 9228
const CDP = `http://127.0.0.1:${CDP_PORT}`
const TMP = join(ROOT, 'scripts', 'tmp-p11')

const electronPkg = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_BIN = [
  join(electronPkg, 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  join(electronPkg, 'electron.exe'),
  join(electronPkg, 'electron')
].find((p) => existsSync(p))

mkdirSync(TMP, { recursive: true })

// ---- fixture -----------------------------------------------------------------

const FIXTURE = [
  '---',
  'title: P11 扩展语法',
  'date: 2026-09-10',
  'tags: [demo, 扩展]',
  'author: zhb',
  '---',
  '',
  '正文段落，含 ==高亮文本== 与 H~2~O 以及 2^10^ 计算[^note]，还有第二条[^1]。',
  '',
  'HTML 很常用，见缩写。',
  '',
  '*[HTML]: 超文本标记语言',
  '',
  '术语',
  ': 第一条定义',
  ': 第二条定义',
  '',
  '## 小节标题 {#custom-id}',
  '',
  '[^note]: 这是脚注内容',
  '[^1]: 另一条脚注'
].join('\n')

const BODY_POS = FIXTURE.indexOf('正文段落')

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

  // Boot: wait for editor, pin prefs so session restore can't clobber the doc.
  check('boot: editor', await waitFor(`!!window.__veloxEditor?.view`, 20000))
  await evaluate(`(() => {
    const raw = JSON.parse(localStorage.getItem('veloxmark.preferences') ?? '{}')
    localStorage.setItem('veloxmark.preferences', JSON.stringify({
      ...raw, restoreLastSession: false, focusMode: false, typewriterMode: false, crashRecoveryEnabled: false, autoSaveMode: 'off', sourceMode: false
    }))
    localStorage.setItem('veloxmark.session', JSON.stringify({ lastFilePath: null, lastFolderPath: null }))
  })()`)
  await send('Page.reload')
  check('reboot: editor back', await waitFor(`!!window.__veloxEditor?.view`, 20000))
  check('boot: extended hook', await waitFor(`!!window.__veloxExtended`, 10000))
  check('boot: export hook', await waitFor(`!!window.__veloxExport`, 10000))

  const setDoc = async (text, cursor = BODY_POS) => {
    await evaluate(`(() => {
      const view = window.__veloxEditor.view
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: ${JSON.stringify(text)} },
        selection: { anchor: ${cursor} },
        scrollIntoView: false
      })
      return view.state.doc.length
    })()`)
  }

  const settle = async () => {
    await evaluate(`(() => {
      const view = window.__veloxEditor.view
      const head = view.state.selection.main.head
      for (let i = 0; i < 8; i++) view.dispatch({ selection: { anchor: head }, scrollIntoView: false })
    })()`)
    await new Promise((r) => setTimeout(r, 350))
  }

  await setDoc(FIXTURE)
  await settle()

  // ---- pure parsers (window.__veloxExtended) ---------------------------------
  const fm = await evaluate(`window.__veloxExtended.parseFrontMatter(${JSON.stringify(FIXTURE)})`)
  check('pure: front matter title', fm?.summary?.title === 'P11 扩展语法', JSON.stringify(fm?.summary))
  check(
    'pure: front matter tags',
    Array.isArray(fm?.summary?.tags) && fm.summary.tags.includes('扩展') && fm.summary.tags.includes('demo'),
    JSON.stringify(fm?.summary?.tags)
  )
  check('pure: front matter keys include author', fm?.summary?.keys?.includes('author'), JSON.stringify(fm?.summary?.keys))
  check('pure: front matter end covers fence', typeof fm?.end === 'number' && fm.end > 30 && fm.end < 120, String(fm?.end))

  const fnNums = await evaluate(`(() => {
    const defs = window.__veloxExtended.collectFootnoteDefs(${JSON.stringify(FIXTURE)})
    return [...defs.values()].map((d) => ({ id: d.id, num: d.num }))
  })()`)
  const noteDef = fnNums.find((d) => d.id === 'note')
  const oneDef = fnNums.find((d) => d.id === '1')
  check('pure: footnote first-ref numbering', noteDef?.num === 1 && oneDef?.num === 2, JSON.stringify(fnNums))

  const attrs = await evaluate(`window.__veloxExtended.parseAttrString('#custom-id .extra .wide')`)
  check(
    'pure: attr string parse',
    attrs?.id === 'custom-id' && Array.isArray(attrs?.classes) && attrs.classes.join(' ') === 'extra wide',
    JSON.stringify(attrs)
  )

  // ---- front matter card -------------------------------------------------------
  const fmCard = await evaluate(`(() => {
    const el = document.querySelector('.cm-md-frontmatter')
    if (!el) return null
    return {
      head: el.querySelector('.cm-md-frontmatter-head')?.textContent ?? '',
      body: el.querySelector('.cm-md-frontmatter-body')?.textContent ?? '',
      kvRows: el.querySelectorAll('.cm-md-frontmatter-kv').length
    }
  })()`)
  check('fm: card rendered', !!fmCard, JSON.stringify(fmCard))
  check('fm: card head label', fmCard?.head === 'Front Matter', fmCard?.head)
  check('fm: card shows title/date/tags', !!fmCard?.body?.includes('P11 扩展语法') && !!fmCard?.body?.includes('2026-09-10') && !!fmCard?.body?.includes('demo, 扩展'), fmCard?.body)
  check('fm: card kv rows >= 3', (fmCard?.kvRows ?? 0) >= 3, String(fmCard?.kvRows))

  // Body decorations exist with cursor parked in the body paragraph.
  const hi = await evaluate(`(() => {
    const el = document.querySelector('.cm-md-highlight')
    return el ? el.textContent : null
  })()`)
  check('highlight: rendered with hidden delimiters', hi === '高亮文本', String(hi))

  const sub = await evaluate(`document.querySelector('.cm-md-sub')?.textContent ?? null`)
  const sup = await evaluate(`document.querySelector('.cm-md-sup')?.textContent ?? null`)
  check('sub: H~2~O → 2', sub === '2', String(sub))
  check('sup: 2^10^ → 10', sup === '10', String(sup))

  // Theme-following highlight colors (明暗主题各一色).
  const bgLight = await evaluate(`(() => {
    const el = document.querySelector('.cm-md-highlight')
    return el ? getComputedStyle(el).backgroundColor : null
  })()`)
  await evaluate(`(() => {
    const app = document.querySelector('.app')
    app.classList.remove('theme-light')
    app.classList.add('theme-dark')
  })()`)
  await new Promise((r) => setTimeout(r, 120))
  const bgDark = await evaluate(`(() => {
    const el = document.querySelector('.cm-md-highlight')
    return el ? getComputedStyle(el).backgroundColor : null
  })()`)
  await evaluate(`(() => {
    const app = document.querySelector('.app')
    app.classList.remove('theme-dark')
    app.classList.add('theme-light')
  })()`)
  check('highlight: light theme bg', !!bgLight && bgLight !== 'rgba(0, 0, 0, 0)', bgLight)
  check('highlight: dark theme differs', !!bgDark && bgDark !== bgLight, `${bgLight} vs ${bgDark}`)

  // ---- footnotes (live preview) ------------------------------------------------
  const refs = await evaluate(`(() => {
    return [...document.querySelectorAll('.cm-md-footnote-ref')].map((el) => el.textContent)
  })()`)
  check('footnote: refs rendered as [1]/[2]', refs.includes('[1]') && refs.includes('[2]'), JSON.stringify(refs))

  const defLines = await evaluate(`document.querySelectorAll('.cm-md-footnote-def').length`)
  check('footnote: def lines styled', defLines >= 2, String(defLines))

  const defSmall = await evaluate(`(() => {
    const el = document.querySelector('.cm-md-footnote-def')
    return el ? getComputedStyle(el).fontSize : null
  })()`)
  check('footnote: def rendered small', !!defSmall && parseFloat(defSmall) < 16, defSmall)

  // Click the first clickable ref ([^note] → num 1) → jump to its definition.
  const clickRef = await evaluate(`(() => {
    const el = [...document.querySelectorAll('.cm-md-footnote-ref-clickable')]
      .find((e) => e.textContent === '[1]')
    if (!el) return false
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
    return true
  })()`)
  await new Promise((r) => setTimeout(r, 250))
  check('footnote: ref click found widget', clickRef === true)
  const afterRefClick = await evaluate(`(() => {
    const view = window.__veloxEditor.view
    const line = view.state.doc.lineAt(view.state.selection.main.head)
    return line.text
  })()`)
  check('footnote: click lands on [^note]: def', afterRefClick.startsWith('[^note]:'), afterRefClick)

  // ---- abbr + definition list + attrs (live preview) ---------------------------
  await setDoc(FIXTURE, BODY_POS)
  await settle()

  const abbrDef = await evaluate(`document.querySelectorAll('.cm-md-abbr-def').length`)
  const dlTerm = await evaluate(`document.querySelectorAll('.cm-md-dl-term').length`)
  const dlDef = await evaluate(`document.querySelectorAll('.cm-md-dl-def').length`)
  check('abbr: definition line styled', abbrDef >= 1, String(abbrDef))
  check('dl: term line styled', dlTerm >= 1, String(dlTerm))
  check('dl: def lines styled', dlDef >= 2, String(dlDef))

  const abbrMark = await evaluate(`(() => {
    const el = document.querySelector('.cm-md-abbr')
    return el ? { text: el.textContent, title: el.getAttribute('title') } : null
  })()`)
  check('abbr: usage mark with title', abbrMark?.text === 'HTML' && abbrMark?.title?.includes('超文本'), JSON.stringify(abbrMark))

  // Heading attr `{#custom-id}` hidden when cursor off the line.
  const attrHidden = await evaluate(`(() => {
    const content = document.querySelector('.cm-editor .cm-content')
    const lines = [...content.querySelectorAll('.cm-line')].map((l) => l.textContent)
    return lines.some((t) => t.includes('小节标题') && !t.includes('{#custom-id}'))
  })()`)
  check('attrs: trailing {#id} hidden on heading', attrHidden === true)

  // ---- front matter click → source edit ----------------------------------------
  const fmClick = await evaluate(`(() => {
    const card = document.querySelector('.cm-md-frontmatter')
    if (!card) return null
    card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
    return window.__veloxEditor.view.state.selection.main.head
  })()`)
  await new Promise((r) => setTimeout(r, 250))
  const fmGoneAfterClick = await evaluate(`!document.querySelector('.cm-md-frontmatter')`)
  const headInFm = await evaluate(`(() => {
    const fm = window.__veloxExtended.parseFrontMatter(window.__veloxEditor.view.state.doc.toString())
    const head = window.__veloxEditor.view.state.selection.main.head
    return head >= 0 && head <= (fm?.end ?? 0)
  })()`)
  check('fm: click keeps cursor inside yaml', fmGoneAfterClick && headInFm === true, `clickHead=${fmClick}`)
  const fmSourceVisible = await evaluate(`(() => {
    const content = document.querySelector('.cm-editor .cm-content')
    return content.textContent.includes('---') && content.textContent.includes('author: zhb')
  })()`)
  check('fm: source shown after click', fmSourceVisible === true)

  // Move cursor back into the body → card returns.
  await setDoc(FIXTURE, BODY_POS)
  await settle()
  const fmBack = await evaluate(`!!document.querySelector('.cm-md-frontmatter')`)
  check('fm: card returns when cursor leaves', fmBack === true)

  // ---- source mode (P08) shows raw markers -------------------------------------
  await evaluate(`window.__veloxEditor.applyLivePreviewConfig(window.__veloxEditor.view, { mode: 'source' })`)
  await new Promise((r) => setTimeout(r, 250))
  const rawVisible = await evaluate(`(() => {
    const t = document.querySelector('.cm-editor .cm-content')?.textContent ?? ''
    return {
      fm: t.includes('author: zhb'),
      highlight: t.includes('==高亮文本=='),
      sub: t.includes('H~2~O'),
      sup: t.includes('2^10^'),
      fn: t.includes('[^note]:'),
      dl: t.includes(': 第一条定义'),
      attr: t.includes('{#custom-id}')
    }
  })()`)
  check(
    'source mode: raw markers visible',
    Object.values(rawVisible).every(Boolean),
    JSON.stringify(rawVisible)
  )
  const noWidgetsInSource = await evaluate(`!document.querySelector('.cm-md-frontmatter') && !document.querySelector('.cm-md-highlight')`)
  check('source mode: no live-preview widgets', noWidgetsInSource === true)
  await evaluate(`window.__veloxEditor.applyLivePreviewConfig(window.__veloxEditor.view, { mode: 'live' })`)
  await new Promise((r) => setTimeout(r, 250))

  // ---- export (P04 pipeline via __veloxExport) ---------------------------------
  const html = await evaluate(
    `window.__veloxExport.renderHtml(${JSON.stringify(FIXTURE)}, { theme: 'light', imageMode: 'embed' })`
  )
  check('export: html produced', typeof html === 'string' && html.length > 100, String(html?.length))

  // Front matter out of body; title promoted to h1.
  check('export: fm yaml not in body', !html.includes('author: zhb') && !html.includes('tags: [demo'), 'yaml leaked')
  check('export: fm title promoted to h1', html.includes('<h1 class="export-fm-title">P11 扩展语法</h1>'), 'missing fm-title h1')

  // Highlight / sub / sup.
  check('export: mark element', html.includes('<mark class="export-mark">高亮文本</mark>'), 'no <mark>')
  check('export: sub element', html.includes('<sub class="export-sub">2</sub>'), 'no <sub>')
  check('export: sup element', html.includes('<sup class="export-sup">10</sup>'), 'no <sup>')
  check('export: no raw == delimiters in body', !html.includes('==高亮文本=='), 'raw highlight leaked')

  // Footnotes at document end + numbered refs.
  check('export: footnotes list at end', html.includes('<ol class="export-footnotes">') && html.includes('这是脚注内容'), 'no footnotes ol')
  check('export: footnote def anchors', html.includes('id="fn-note"') && html.includes('id="fn-1"'), 'no fn anchors')
  check('export: footnote ref sup with num', /export-footnote-ref"[^>]*><a href="#fn-note">1<\/a>/.test(html), 'no numbered ref')
  check('export: footnote backref', html.includes('export-footnote-backref'), 'no backref')
  check('export: footnote content rendered', html.includes('另一条脚注'), 'missing fn text')

  // Abbr / DL / attrs.
  check('export: abbr with title', html.includes('<abbr title="超文本标记语言">HTML</abbr>'), 'no abbr')
  check('export: definition list', html.includes('<dl class="export-dl">') && html.includes('<dt>术语</dt>') && html.includes('<dd>第一条定义</dd>') && html.includes('<dd>第二条定义</dd>'), 'no dl')
  check('export: heading id attr', html.includes('<h2 id="custom-id">'), 'no h2 id')
  check('export: raw attr braces stripped', !html.includes('{#custom-id}'), 'attr text leaked')

  console.log('')
  if (failures.length) {
    console.log(`P11 e2e: ${failures.length} failure(s): ${failures.join(', ')}`)
    process.exitCode = 1
  } else {
    console.log('P11 e2e: all checks passed')
  }

  ws.close()
  if (app) app.kill()
}

main().catch((err) => {
  console.error('P11 e2e crashed:', err)
  if (app) app.kill()
  process.exitCode = 1
})
