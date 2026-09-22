import { formatTable } from '../table/parse'

/**
 * P19: clipboard HTML → Markdown, no turndown dependency.
 *
 * Ships with a small self-contained HTML fragment parser instead of
 * DOMParser so the converter is one code path everywhere (renderer paste,
 * menu paste via IPC, and vitest in a DOM-less node environment).
 * Clipboard payloads from browsers are serialized, well-formed fragments —
 * the parser tolerates stray `<`, unclosed tags and entity references, and
 * anything unparseable throws so the paste pipeline can fall back to text.
 */

type HNode =
  | { type: 'el'; tag: string; attrs: Record<string, string>; children: HNode[] }
  | { type: 'text'; text: string }

const VOID_TAGS = new Set([
  'br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'
])
/** Whole-subtree drops: element AND its content never reach the markdown. */
const RAW_DROP_TAGS = new Set(['script', 'style', 'iframe', 'noscript', 'template'])
/** Open tags that implicitly close a same-name (or cell) ancestor. */
const BLOCK_OPENERS = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'blockquote',
  'pre', 'hr', 'section', 'article', 'header', 'footer', 'main', 'aside', 'figure', 'figcaption', 'nav'
])
/** Serializer-level drops for document scaffolding that sometimes wraps fragments. */
const SILENT_TAGS = new Set(['head', 'title', 'meta', 'link', 'style', 'script'])

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', hellip: '…', mdash: '—', ndash: '–'
}

function decodeEntities(text: string): string {
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m
    }
    return ENTITIES[body.toLowerCase()] ?? m
  })
}

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw))) {
    out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '')
  }
  return out
}

function parseFragment(html: string): HNode[] {
  const root: HNode = { type: 'el', tag: '#root', attrs: {}, children: [] }
  const stack: Array<{ type: 'el'; tag: string; attrs: Record<string, string>; children: HNode[] }> = [root]
  const top = (): (typeof stack)[number] => stack[stack.length - 1]
  const pushText = (text: string): void => {
    if (text) top().children.push({ type: 'text', text })
  }
  const popTo = (tag: string): void => {
    for (let s = stack.length - 1; s > 0; s--) {
      if (stack[s].tag === tag) {
        stack.length = s
        return
      }
    }
  }
  const implicitClose = (tag: string): void => {
    const t = top().tag
    if (tag === 'li' && t === 'li') stack.pop()
    else if ((tag === 'td' || tag === 'th') && (t === 'td' || t === 'th')) stack.pop()
    else if (tag === 'tr') {
      while (stack.length > 1 && ['td', 'th', 'tr'].includes(top().tag)) stack.pop()
    } else if (BLOCK_OPENERS.has(tag) && t === 'p') stack.pop()
  }

  let i = 0
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt < 0) {
      pushText(html.slice(i))
      break
    }
    if (lt > i) pushText(html.slice(i, lt))
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      i = end < 0 ? html.length : end + 3
      continue
    }
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      const end = html.indexOf('>', lt)
      i = end < 0 ? html.length : end + 1
      continue
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/.exec(html.slice(lt))
    if (!m) {
      pushText('<')
      i = lt + 1
      continue
    }
    const [full, close, rawTag, rawAttrs, selfClose] = m
    const tag = rawTag.toLowerCase()
    i = lt + full.length
    if (close) {
      popTo(tag)
      continue
    }
    if (RAW_DROP_TAGS.has(tag)) {
      const closeRe = new RegExp(`</${tag}\\s*>`, 'i')
      const cm = closeRe.exec(html.slice(i))
      i = cm ? i + cm.index + cm[0].length : html.length
      continue
    }
    implicitClose(tag)
    const el = { type: 'el' as const, tag, attrs: parseAttrs(rawAttrs), children: [] as HNode[] }
    top().children.push(el)
    if (selfClose || VOID_TAGS.has(tag)) continue
    stack.push(el)
  }
  return root.children
}

/** Concatenated text content (entities decoded; raw whitespace preserved). */
function rawText(node: HNode): string {
  if (node.type === 'text') return decodeEntities(node.text)
  if (RAW_DROP_TAGS.has(node.tag) || SILENT_TAGS.has(node.tag)) return ''
  return node.children.map(rawText).join('')
}

function codeSpan(text: string): string {
  const runs = text.match(/`+/g) ?? []
  const fence = '`'.repeat(Math.max(1, ...runs.map((r) => r.length + 1)))
  const pad = /^`|`$/.test(text) ? ' ' : ''
  return `${fence}${pad}${text}${pad}${fence}`
}

function inlineMd(nodes: HNode[]): string {
  let out = ''
  for (const n of nodes) {
    if (n.type === 'text') {
      out += decodeEntities(n.text)
      continue
    }
    const tag = n.tag
    if (SILENT_TAGS.has(tag) || RAW_DROP_TAGS.has(tag)) continue
    if (tag === 'br') out += '  \n'
    else if (tag === 'strong' || tag === 'b') {
      const t = inlineMd(n.children).trim()
      if (t) out += `**${t}**`
    } else if (tag === 'em' || tag === 'i') {
      const t = inlineMd(n.children).trim()
      if (t) out += `*${t}*`
    } else if (tag === 'del' || tag === 's' || tag === 'strike') {
      const t = inlineMd(n.children).trim()
      if (t) out += `~~${t}~~`
    } else if (tag === 'code') out += codeSpan(rawText(n))
    else if (tag === 'a') {
      const href = n.attrs.href ?? ''
      const t = inlineMd(n.children).trim() || href
      out += href ? `[${t}](${href})` : t
    } else if (tag === 'img') {
      const src = n.attrs.src ?? ''
      if (src) out += `![${n.attrs.alt ?? ''}](${src})`
    } else if (tag === 'hr') out += ''
    else out += inlineMd(n.children)
  }
  return out
}

function listToMd(el: HNode & { type: 'el' }, indent: string): string {
  const ordered = el.tag === 'ol'
  const start = parseInt(el.attrs.start ?? '1', 10)
  let n = Number.isFinite(start) && start > 0 ? start : 1
  const childIndent = indent + (ordered ? '   ' : '  ')
  const lines: string[] = []
  for (const ch of el.children) {
    if (ch.type !== 'el' || ch.tag !== 'li') {
      const b = blocksToMd([ch], 0)
      if (b.trim()) lines.push(b.trim())
      continue
    }
    const inlineParts: HNode[] = []
    const restBlocks: string[] = []
    let buf: HNode[] = []
    const flushBuf = (): void => {
      if (buf.length) {
        inlineParts.push(...buf)
        buf = []
      }
    }
    for (const c of ch.children) {
      if (c.type === 'el' && (c.tag === 'ul' || c.tag === 'ol' || BLOCK_OPENERS.has(c.tag))) {
        flushBuf()
        if (c.tag === 'ul' || c.tag === 'ol') restBlocks.push(listToMd(c, ''))
        else {
          const b = blocksToMd([c], 0).trim()
          if (b) restBlocks.push(b)
        }
      } else buf.push(c)
    }
    flushBuf()
    const marker = ordered ? `${n}. ` : '- '
    let head = inlineMd(inlineParts).replace(/\s*\n\s*/g, ' ').trim()
    // First block-level child of an li whose text never reached inlineParts
    // (e.g. <li><p>first</p>…) — lift its leading line onto the marker line.
    if (!head && restBlocks.length > 0) {
      const first = restBlocks[0]
      const nl = first.indexOf('\n')
      const firstLine = (nl === -1 ? first : first.slice(0, nl)).trim()
      const structured = /^[>#|`]|^\s*(?:[-*+]|\d+[.)])\s/.test(firstLine)
      if (firstLine && !structured) {
        head = firstLine
        const rest = nl === -1 ? '' : first.slice(nl + 1).replace(/^\n+/, '')
        if (rest.trim()) restBlocks[0] = rest
        else restBlocks.shift()
      }
    }
    lines.push(indent + marker + head)
    for (const rb of restBlocks) {
      for (const l of rb.split('\n')) lines.push(l ? childIndent + l : l)
    }
    if (ordered) n++
  }
  return lines.join('\n')
}

function preToMd(el: HNode & { type: 'el' }): string {
  const codeEl = el.children.find((c) => c.type === 'el' && c.tag === 'code')
  let lang = ''
  if (codeEl && codeEl.type === 'el') {
    const cls = codeEl.attrs.class ?? ''
    const m = /(?:^|\s)(?:language|lang)-([\w+#.-]+)/.exec(cls)
    if (m) lang = m[1]
  }
  const text = rawText(codeEl && codeEl.type === 'el' ? codeEl : el)
  const runs = text.match(/`+/g) ?? []
  const fence = '`'.repeat(Math.max(3, ...runs.map((r) => r.length + 1)))
  return `${fence}${lang}\n${text.replace(/\n+$/, '')}\n${fence}`
}

function tableToMd(el: HNode & { type: 'el' }): string {
  const rows: string[][] = []
  const aligns: string[] = []
  const walk = (n: HNode): void => {
    if (n.type !== 'el') return
    if (n.tag === 'tr') {
      const cells: string[] = []
      let ci = 0
      for (const c of n.children) {
        if (c.type !== 'el' || (c.tag !== 'td' && c.tag !== 'th')) continue
        const text = inlineMd(c.children).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()
        cells.push(text)
        const styleAlign = /text-align:\s*(left|center|right)/i.exec(c.attrs.style ?? '')?.[1]?.toLowerCase()
        const al = (c.attrs.align ?? styleAlign ?? '').toLowerCase()
        const name = al === 'center' ? 'center' : al === 'right' ? 'right' : al === 'left' ? 'left' : ''
        if (ci >= aligns.length) aligns.push(name)
        else if (!aligns[ci] && name) aligns[ci] = name
        ci++
      }
      if (cells.length) rows.push(cells)
      return
    }
    if (SILENT_TAGS.has(n.tag) || RAW_DROP_TAGS.has(n.tag)) return
    for (const c of n.children) walk(c)
  }
  walk(el)
  if (!rows.length) return ''
  const colCount = Math.max(...rows.map((r) => r.length))
  while (aligns.length < colCount) aligns.push('')
  return formatTable(aligns.slice(0, colCount), rows)
}

function blocksToMd(nodes: HNode[], listDepth: number): string {
  const out: string[] = []
  let para: HNode[] = []
  const flush = (): void => {
    if (!para.length) return
    const t = inlineMd(para).replace(/\n{3,}/g, '\n\n').trim()
    if (t) out.push(t)
    para = []
  }
  for (const n of nodes) {
    if (n.type === 'text') {
      if (n.text.trim() || para.length) para.push(n)
      continue
    }
    const tag = n.tag
    if (SILENT_TAGS.has(tag) || RAW_DROP_TAGS.has(tag)) continue
    if (/^h[1-6]$/.test(tag)) {
      flush()
      const t = inlineMd(n.children).trim()
      if (t) out.push(`${'#'.repeat(Number(tag[1]))} ${t}`)
    } else if (tag === 'p') {
      flush()
      const t = inlineMd(n.children).replace(/\n{3,}/g, '\n\n').trim()
      if (t) out.push(t)
    } else if (tag === 'hr') {
      flush()
      out.push('---')
    } else if (tag === 'ul' || tag === 'ol') {
      flush()
      out.push(listToMd(n, '  '.repeat(listDepth)))
    } else if (tag === 'blockquote') {
      flush()
      const inner = blocksToMd(n.children, 0).trim()
      if (inner) out.push(inner.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n'))
    } else if (tag === 'table') {
      flush()
      const t = tableToMd(n)
      if (t) out.push(t)
    } else if (tag === 'pre') {
      flush()
      out.push(preToMd(n))
    } else if (
      tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' ||
      tag === 'footer' || tag === 'main' || tag === 'aside' || tag === 'figure' ||
      tag === 'figcaption' || tag === 'nav' || tag === 'body' || tag === 'html' ||
      tag === 'li' || tag === 'dt' || tag === 'dd' || tag === 'tr' || tag === 'thead' ||
      tag === 'tbody' || tag === 'tfoot'
    ) {
      flush()
      const inner = blocksToMd(n.children, listDepth)
      if (inner.trim()) out.push(inner.trim())
    } else {
      // Inline-level unknown tags accumulate into the open paragraph (unwrap).
      para.push(n)
    }
  }
  flush()
  return out.join('\n\n')
}

/**
 * UX-P19 wave⑥-4 F2: one-shot fault seam for the throw→plain fallback contract.
 * Unit tests + `__veloxP19.faultNextTransform` arm it; the next htmlToMarkdown
 * call throws exactly once so both fallback gates can be hard-verified.
 */
let faultNextHtmlTransform = false
export function faultNextHtmlTransformOnce(): void {
  faultNextHtmlTransform = true
}

/**
 * Convert a clipboard HTML fragment to Markdown.
 * Throws on unparseable input — callers fall back to the plain-text flavor.
 */
export function htmlToMarkdown(html: string): string {
  if (faultNextHtmlTransform) {
    faultNextHtmlTransform = false
    throw new Error('P19 fault injection: htmlToMarkdown throw (e2e/unit seam)')
  }
  const nodes = parseFragment(html)
  return blocksToMd(nodes, 0).replace(/\n{3,}/g, '\n\n').trim()
}

/** Same, but null instead of throw (paste-pipeline fallback gate). */
export function htmlToMarkdownSafe(html: string): string | null {
  try {
    return htmlToMarkdown(html)
  } catch {
    return null
  }
}

/**
 * Collect `![alt](src)` image srcs from converted markdown (P05 second pass).
 */
export function collectImageSrcs(markdown: string): string[] {
  const out: string[] = []
  const re = /!\[[^\]]*\]\(([^)\s]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown))) out.push(m[1])
  return out
}
