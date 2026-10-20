import { alignmentOf, formatTable } from './table/parse'

export interface FormatWarning {
  line: number
  kind: 'unclosed-fence'
}

export interface FormatResult {
  text: string
  warnings: FormatWarning[]
  changed: number
}

let faultNextFormat = false
export function faultNextFormatOnce(): void {
  faultNextFormat = true
}

interface EmitLine {
  text: string
  kind: 'fence-open' | 'heading' | 'table' | 'blank' | 'other'
}

const OPEN_FENCE_RE = /^(\s*)(`{3,}|~{3,})(.*)$/
const CLOSE_FENCE_RE = /^(\s*)(`{3,}|~{3,})[ \t]*$/
const HEADING_RE = /^(\s{0,3})(#{1,6})(\s*)(.*)$/
const QUOTE_RE = /^(\s*)(>+)(.*)$/
const UL_RE = /^(\s*)([*+])([ \t]+)(.*)$/
const ORD_RE = /^(\s*)(\d{1,9})([.)])([ \t]*)(.*)$/
const HR_RE = /^\s{0,3}([-*_])([ \t]*\1){2,}[ \t]*$/

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '\\|'
      i++
      continue
    }
    if (s[i] === '|') {
      cells.push(cur.trim())
      cur = ''
      continue
    }
    cur += s[i]
  }
  cells.push(cur.trim())
  return cells
}

function isDelimLine(line: string): boolean {
  if (!line.includes('|')) return false
  const cells = splitRow(line)
  return cells.length >= 1 && cells.every((c) => /^:?-+:?$/.test(c))
}

function isTableStart(lines: string[], raw: boolean[], i: number): boolean {
  const n = lines.length
  if (i + 1 >= n) return false
  if (raw[i] || raw[i + 1]) return false
  if (!lines[i].includes('|') || lines[i].trim() === '') return false
  return isDelimLine(lines[i + 1])
}

export function formatMarkdown(input: string): FormatResult {
  if (faultNextFormat) {
    faultNextFormat = false
    throw new Error('P23 fault injection: formatMarkdown throw (e2e seam)')
  }
  const warnings: FormatWarning[] = []
  if (input === '') return { text: '', warnings, changed: 0 }

  const src = input.replace(/\r\n?/g, '\n')
  const original = src.split('\n')
  const lines = original.slice()
  const n0 = lines.length
  const raw = new Array<boolean>(n0).fill(false)
  const fenceOpenIdx = new Set<number>()

  let fence: { char: string; count: number; openIdx: number } | null = null
  for (let i = 0; i < n0; i++) {
    const line = lines[i]
    if (fence) {
      raw[i] = true
      const m = line.match(CLOSE_FENCE_RE)
      if (m && m[2][0] === fence.char && m[2].length >= fence.count) fence = null
      continue
    }
    const m = line.match(OPEN_FENCE_RE)
    if (!m) continue
    const marker = m[2]
    fence = { char: marker[0], count: marker.length, openIdx: i }
    raw[i] = true
    fenceOpenIdx.add(i)
    const lang = m[3].trim()
    lines[i] = `${m[1]}${marker}${lang}`
  }
  if (fence) warnings.push({ line: fence.openIdx + 1, kind: 'unclosed-fence' })

  for (let i = 0; i < n0; i++) {
    if (raw[i]) continue
    let line = lines[i]
    const tw = line.match(/( +)$/)
    if (tw) {
      const cnt = tw[1].length
      if (cnt !== 2) {
        line = cnt > 2 ? line.slice(0, line.length - cnt) + '  ' : line.slice(0, line.length - cnt)
      }
    }
    line = line.replace(/\t+$/, '')

    const atx = line.match(HEADING_RE)
    if (atx) {
      const body = atx[4].replace(/[ \t]+#+[ \t]*$/, '').trim()
      line = body === '' ? `${atx[1]}${atx[2]}` : `${atx[1]}${atx[2]} ${body}`
    } else if (HR_RE.test(line)) {
    } else if (QUOTE_RE.test(line)) {
      const q = line.match(QUOTE_RE)!
      const content = q[3].replace(/^[ \t]+/, '')
      line = content === '' ? q[1] + q[2] : `${q[1]}${q[2]} ${content}`
    } else if (UL_RE.test(line)) {
      const ul = line.match(UL_RE)!
      line = `${ul[1]}- ${ul[4].replace(/^[ \t]+/, '')}`
    }
    lines[i] = line
  }

  {
    const stack: Array<{ indent: string; next: number }> = []
    for (let i = 0; i < n0; i++) {
      if (raw[i]) {
        stack.length = 0
        continue
      }
      const line = lines[i]
      if (line.trim() === '') continue
      const m = line.match(ORD_RE)
      if (!m) {
        stack.length = 0
        continue
      }
      const indent = m[1]
      while (stack.length > 0 && stack[stack.length - 1].indent.length > indent.length) {
        stack.pop()
      }
      let num: number
      if (stack.length > 0 && stack[stack.length - 1].indent === indent) {
        num = stack[stack.length - 1].next
        stack[stack.length - 1].next = num + 1
      } else {
        stack.push({ indent, next: 2 })
        num = 1
      }
      lines[i] = `${indent}${num}${m[3]}${m[4]}${m[5]}`
    }
  }

  const emit: EmitLine[] = []
  let i = 0
  while (i < n0) {
    if (raw[i]) {
      emit.push({
        text: lines[i],
        kind: fenceOpenIdx.has(i) ? 'fence-open' : 'other'
      })
      i++
      continue
    }
    if (isTableStart(lines, raw, i)) {
      const rows: string[][] = [splitRow(lines[i])]
      let j = i + 2
      while (j < n0 && !raw[j] && lines[j].trim() !== '' && lines[j].includes('|')) {
        rows.push(splitRow(lines[j]))
        j++
      }
      const aligns = splitRow(lines[i + 1]).map(alignmentOf)
      const formatted = formatTable(aligns, rows)
      const fl = formatted.split('\n')
      for (let k = 0; k < fl.length; k++) {
        emit.push({ text: fl[k], kind: k === 0 ? 'table' : 'other' })
      }
      i = j
      continue
    }
    emit.push({
      text: lines[i],
      kind: lines[i].trim() === '' ? 'blank' : HEADING_RE.test(lines[i]) ? 'heading' : 'other'
    })
    i++
  }

  const res: EmitLine[] = []
  for (const item of emit) {
    if (item.kind === 'blank') {
      if (res.length > 0 && res[res.length - 1].kind === 'blank') continue
      res.push(item)
      continue
    }
    if (
      (item.kind === 'heading' || item.kind === 'fence-open' || item.kind === 'table') &&
      res.length > 0 &&
      res[res.length - 1].kind !== 'blank'
    ) {
      res.push({ text: '', kind: 'blank' })
    }
    res.push(item)
  }

  let text = res.map((e) => e.text).join('\n').replace(/\n+$/, '')
  if (text.length > 0) text += '\n'

  const after = text === '' ? [] : text.replace(/\n$/, '').split('\n')
  let changed = Math.abs(original.length - after.length)
  const stripTail = (arr: string[]): string[] => {
    const a = arr.slice()
    while (a.length > 0 && a[a.length - 1] === '') a.pop()
    return a
  }
  const a = stripTail(original)
  const b = stripTail(after)
  changed = Math.abs(a.length - b.length)
  for (let k = 0; k < Math.min(a.length, b.length); k++) {
    if (a[k] !== b[k]) changed++
  }

  return { text, warnings, changed }
}
