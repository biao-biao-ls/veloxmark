/**
 * codeEdit — code 双区编辑退出纯逻辑断言（FE-09 P1，mathEdit 同构）。
 *
 * findFenceBlockAt / fenceExitAnchor 为纯函数：聚焦面板（P28 blockTouched）
 * 的收拢 close 语义 = 把光标移出围栏块（exitCodeEdit 薄封装这两步）。
 * 块跨度 = 开栏行行首 → 闭栏行行尾（未闭合延伸到文末），与 blockTouched 含
 * 围栏标记的口径一致。
 */
import { describe, expect, it } from 'vitest'
import { fenceExitAnchor, findFenceBlockAt } from './codeEdit'

const doc = 'before\n```js\nconst x = 1\n```\nafter\n'
const openFrom = doc.indexOf('```js')
const bodyPos = doc.indexOf('const')
const closeFrom = doc.indexOf('```', openFrom + 4)
const closeTo = closeFrom + 3 // closing fence line `to`

describe('findFenceBlockAt（围栏块定位）', () => {
  it('光标在代码体内 → 命中整块（含围栏标记）', () => {
    const b = findFenceBlockAt(doc, bodyPos)
    expect(b).not.toBeNull()
    expect(b!.start).toBe(doc.lastIndexOf('\n', openFrom) + 1)
    expect(b!.end).toBe(closeTo)
    expect(b!.closed).toBe(true)
  })
  it('光标在开栏/闭栏行上同样命中（blockTouched 含围栏标记）', () => {
    expect(findFenceBlockAt(doc, openFrom)).not.toBeNull()
    expect(findFenceBlockAt(doc, closeTo)).not.toBeNull()
    expect(findFenceBlockAt(doc, closeFrom)).not.toBeNull()
  })
  it('块外（前后段落/两块之间）→ null', () => {
    expect(findFenceBlockAt(doc, 0)).toBeNull()
    expect(findFenceBlockAt(doc, doc.indexOf('after'))).toBeNull()
    const two = '```js\na\n```\ntext\n```py\nb\n```\n'
    expect(findFenceBlockAt(two, two.indexOf('text'))).toBeNull()
  })
  it('波浪线围栏同语义；闭栏带信息串不算闭栏', () => {
    const t = '~~~py\nprint(1)\n~~~\n'
    const b = findFenceBlockAt(t, t.indexOf('print'))
    expect(b).not.toBeNull()
    expect(b!.closed).toBe(true)
    // 闭栏带信息串 → 块延伸到文末
    const bad = '~~~py\nprint(1)\n~~~ info\n'
    const b2 = findFenceBlockAt(bad, bad.indexOf('print'))
    expect(b2!.closed).toBe(false)
    expect(b2!.end).toBe(bad.length)
  })
  it('未闭合围栏延伸到文末（closed=false）', () => {
    const t = 'intro\n```\nstill open\n'
    const b = findFenceBlockAt(t, t.indexOf('still'))
    expect(b).not.toBeNull()
    expect(b!.closed).toBe(false)
    expect(b!.end).toBe(t.length)
  })
  it('行内反引号不是围栏；缩进 ≤3 空格仍是围栏', () => {
    expect(findFenceBlockAt('a `code` b\n', 3)).toBeNull()
    const indented = '  ```\n  body\n  ```\n'
    expect(findFenceBlockAt(indented, indented.indexOf('body'))).not.toBeNull()
  })
})

describe('fenceExitAnchor（退出落点，exitMathEdit 同构）', () => {
  it('闭合块且后有正文：落到闭栏行换行之后（完全离开 blockTouched 跨度）', () => {
    const b = findFenceBlockAt(doc, bodyPos)!
    expect(fenceExitAnchor(doc, b)).toBe(closeTo + 1)
    expect(fenceExitAnchor(doc, b)).toBe(doc.indexOf('after'))
  })
  it('文末未闭合块：退回开栏行之前（exitTableEdit 先例）', () => {
    const t = 'intro\n```\nstill open'
    const b = findFenceBlockAt(t, t.indexOf('still'))!
    expect(fenceExitAnchor(t, b)).toBe(5) // 'intro\n' 的换行位
    expect(fenceExitAnchor(t, b)).toBe(t.lastIndexOf('\n', b.start - 1))
  })
  it('闭合块卡在文末（无后续换行）：同样退回首行之前', () => {
    const t = '```js\ncode\n```'
    const b = findFenceBlockAt(t, t.indexOf('code'))!
    expect(b.closed).toBe(true)
    expect(fenceExitAnchor(t, b)).toBe(0)
  })
})
