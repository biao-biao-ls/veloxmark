/**
 * mermaid last-good position-key remap — AC-ERR-11 判据 1（IT-03 PATH-08 P2）
 * + 多标签文档隔离（IT-03 PATH-08 r2 残余：跨标签键漂移 / 同位置串图）。
 *
 * 缺陷：last-good 缓存按 fence 文档位置作键（Map<number, MermaidGoodRender>），
 * fence 之前任意编辑使位置漂移 → getMermaidLastGood(sourceFrom) miss →
 * failed 占位，违反「保留上一次成功渲染的图」。本组钉住：
 * ① 位置漂移（fence 前插文）后旧 last-good 仍按新位置命中；
 * ② 主场景回归（fence 内改语法：键不动，S3 dim 旧图 + 错误条路径的前提）；
 * ③ 防串图：fence 被删/整段替换时该条目丢弃，不得把 A 的旧图映射给 B；
 * ④ mermaidLastGoodRemap StateField 在 state update 里完成重映射（挂接钉），
 *    且字段值即文档身份（每 DocTab 链一枚、update 恒定）。
 * ⑤ 跨标签隔离（r2）：B 的 ChangeDesc 不得重映射 A 命名空间的键；同 sourceFrom
 *    各归各命名空间互不可见。
 * 纯逻辑面（无 DOM、不渲染 widget）；mountMermaidRender 的 DOM 侧由 CDP S3 覆盖。
 */
import { ChangeSet, EditorState, Text } from '@codemirror/state'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearMermaidLastGood,
  getMermaidLastGood,
  mermaidDocIdOf,
  mermaidLastGoodRemap,
  remapMermaidLastGood,
  rememberMermaidGood,
  type MermaidDocId,
  type MermaidGoodRender
} from './errMemory'

const A: MermaidGoodRender = {
  svg: '<svg data-fence="a"></svg>',
  code: 'graph TD; A-->B',
  theme: 'light'
}
const B: MermaidGoodRender = {
  svg: '<svg data-fence="b"></svg>',
  code: 'graph LR; C-->D',
  theme: 'light'
}

// doc: 1 intro / 2 ```mermaid / 3 graph TD / 4 ``` / 5 tail
const DOC = Text.of(['intro', '```mermaid', 'graph TD', '```', 'tail'])
const FENCE_FROM = DOC.line(2).from

function insertAt(from: number, insert: string): ChangeSet {
  return ChangeSet.of([{ from, insert }], DOC.length)
}

describe('remapMermaidLastGood (AC-ERR-11 判据 1)', () => {
  // 单文档命名空间（各用例独立 token，与其它用例零共享）
  const doc: MermaidDocId = {}

  beforeEach(() => {
    clearMermaidLastGood()
  })

  it('命中保持：fence 前插文使位置漂移后，旧 last-good 仍按新键命中（P2 缺陷）', () => {
    rememberMermaidGood(doc, FENCE_FROM, A)
    const changes = insertAt(0, 'new paragraph\n')
    remapMermaidLastGood(doc, changes)
    const shifted = FENCE_FROM + 'new paragraph\n'.length
    expect(getMermaidLastGood(doc, shifted)).toEqual(A)
    // 旧键不再持有（条目已搬家，不是双份）
    expect(getMermaidLastGood(doc, FENCE_FROM)).toBeUndefined()
  })

  it('命中保持：fence 前删文同样重映射键', () => {
    // delete "intro\n" (doc line 1) — fence moves up one line
    const changes = ChangeSet.of([{ from: 0, to: DOC.line(2).from }], DOC.length)
    rememberMermaidGood(doc, FENCE_FROM, A)
    remapMermaidLastGood(doc, changes)
    expect(getMermaidLastGood(doc, 0)).toEqual(A)
  })

  it('主场景回归：fence 内改语法（变更在 fence 起点之后）键不动仍命中', () => {
    rememberMermaidGood(doc, FENCE_FROM, A)
    // break the body (S3: dim old svg + error bar) — same shape as the
    // mountMermaidRender catch path that then looks the entry up again
    const bodyFrom = DOC.line(3).from
    const changes = ChangeSet.of(
      [{ from: bodyFrom + 2, to: bodyFrom + 7, insert: 'oops(' }],
      DOC.length
    )
    remapMermaidLastGood(doc, changes)
    expect(getMermaidLastGood(doc, FENCE_FROM)).toEqual(A)
  })

  it('assoc=1：在 fence 起点整行前插（Enter 于 ```mermaid 行首）键随 fence 下移', () => {
    rememberMermaidGood(doc, FENCE_FROM, A)
    const changes = insertAt(FENCE_FROM, '\n')
    remapMermaidLastGood(doc, changes)
    expect(getMermaidLastGood(doc, FENCE_FROM + 1)).toEqual(A)
  })

  it('防串图：A 的 fence 被整段删除后不得把 A 映射到 B 的键上', () => {
    // A owns lines 2-4; B's key sits on line 5 ("tail") — delete fence A entirely
    const bFrom = DOC.line(5).from
    rememberMermaidGood(doc, FENCE_FROM, A)
    rememberMermaidGood(doc, bFrom, B)
    const changes = ChangeSet.of([{ from: FENCE_FROM, to: bFrom }], DOC.length)
    remapMermaidLastGood(doc, changes)
    // B survives, remapped onto the vacated fence position
    expect(getMermaidLastGood(doc, FENCE_FROM)).toEqual(B)
    expect(getMermaidLastGood(doc, FENCE_FROM)).not.toEqual(A)
    // A's SVG must not surface under any surviving key (no re-homing of a dead fence)
    expect(getMermaidLastGood(doc, bFrom)).not.toEqual(A)
  })

  it('防串图：fence 起点字符被替换（起点已亡）时条目丢弃', () => {
    const bFrom = DOC.line(5).from
    rememberMermaidGood(doc, FENCE_FROM, A)
    rememberMermaidGood(doc, bFrom, B)
    // overwrite the first backtick of the opener
    const changes = ChangeSet.of([{ from: FENCE_FROM, to: FENCE_FROM + 1, insert: 'x' }], DOC.length)
    remapMermaidLastGood(doc, changes)
    // A dropped — nothing may land where its SVG could be mistaken for another fence's
    for (const probe of [FENCE_FROM, FENCE_FROM - 1, FENCE_FROM + 1, 0, bFrom]) {
      expect(getMermaidLastGood(doc, probe)).not.toEqual(A)
    }
    // B's key is unchanged (replacement is length-preserving and before it)
    expect(getMermaidLastGood(doc, bFrom)).toEqual(B)
  })

  it('无变更/空缓存：no-op 不抛错', () => {
    remapMermaidLastGood(doc, ChangeSet.of([], DOC.length))
    rememberMermaidGood(doc, FENCE_FROM, A)
    remapMermaidLastGood(doc, ChangeSet.of([], DOC.length))
    expect(getMermaidLastGood(doc, FENCE_FROM)).toEqual(A)
  })

  it('mermaidLastGoodRemap StateField：docChanged 事务里完成重映射（挂接钉）', () => {
    const state = EditorState.create({
      doc: DOC,
      extensions: [mermaidLastGoodRemap]
    })
    const id = mermaidDocIdOf(state)
    rememberMermaidGood(id, FENCE_FROM, A)
    const next = state.update({ changes: insertAt(0, 'new paragraph\n') }).state
    const shifted = FENCE_FROM + 'new paragraph\n'.length
    expect(getMermaidLastGood(mermaidDocIdOf(next), shifted)).toEqual(A)
    // 身份在 update 链上恒定（异步 remember 与后续 remap 同命名空间的前提）
    expect(mermaidDocIdOf(next)).toBe(id)
    // 无 doc 变更的事务不动键
    const same = next.update({ selection: { anchor: 0 } }).state
    expect(getMermaidLastGood(mermaidDocIdOf(same), same.doc.lineAt(shifted).from)).toEqual(A)
  })
})

describe('跨标签文档隔离（多 DocTab 共享模块缓存，AC-ERR-11 再入向量）', () => {
  beforeEach(() => {
    clearMermaidLastGood()
  })

  it('验收1：B 的插/删/替换不得使 A 的键漂移（B 的 ChangeDesc 只动 B 命名空间）', () => {
    const docA: MermaidDocId = {}
    const docB: MermaidDocId = {}
    rememberMermaidGood(docA, FENCE_FROM, A)
    // 插入：B insert at 0 — 修复前全局 map 会把 A 的键一并 mapPos 漂移
    remapMermaidLastGood(docB, insertAt(0, 'new paragraph\n'))
    expect(getMermaidLastGood(docA, FENCE_FROM)).toEqual(A)
    // 漂移目标位不得凭空出现条目（B 命名空间自己也是空的）
    expect(getMermaidLastGood(docA, FENCE_FROM + 'new paragraph\n'.length)).toBeUndefined()
    expect(getMermaidLastGood(docB, FENCE_FROM + 'new paragraph\n'.length)).toBeUndefined()
    // 删除：B 删掉首行 — A 键仍钉在原位
    remapMermaidLastGood(docB, ChangeSet.of([{ from: 0, to: DOC.line(2).from }], DOC.length))
    expect(getMermaidLastGood(docA, FENCE_FROM)).toEqual(A)
    // 替换：B 整段替换前缀 — A 键仍钉在原位
    remapMermaidLastGood(
      docB,
      ChangeSet.of([{ from: 0, to: DOC.line(2).from, insert: 're' }], DOC.length)
    )
    expect(getMermaidLastGood(docA, FENCE_FROM)).toEqual(A)
    // 三形状后 B 命名空间始终未被 A 的条目污染
    expect(getMermaidLastGood(docB, FENCE_FROM)).toBeUndefined()
  })

  it('验收1：StateField 链视角——两 DocTab 状态并存，B 事务后 A failed 态仍按原键命中（dim 旧图前提）', () => {
    const stateA = EditorState.create({ doc: DOC, extensions: [mermaidLastGoodRemap] })
    const stateB = EditorState.create({ doc: DOC, extensions: [mermaidLastGoodRemap] })
    const idA = mermaidDocIdOf(stateA)
    const idB = mermaidDocIdOf(stateB)
    // 每 DocTab 链独立身份
    expect(idA).not.toBe(idB)
    rememberMermaidGood(idA, FENCE_FROM, A)
    // B inserts at 0 — 覆盖 useTabStore view.setState 切标签后 B 的事务面
    stateB.update({ changes: insertAt(0, 'new paragraph\n') })
    // A fence failed 态切回后仍按原 sourceFrom 命中 last-good（不落 showPlaceholder）
    expect(getMermaidLastGood(idA, FENCE_FROM)).toEqual(A)
    // A 命名空间无键漂移残留（旧位置之外不得多出条目）
    expect(getMermaidLastGood(idA, FENCE_FROM + 'new paragraph\n'.length)).toBeUndefined()
  })

  it('验收2：同 sourceFrom 跨标签不串图（各归各命名空间互不可见）', () => {
    const docA: MermaidDocId = {}
    const docB: MermaidDocId = {}
    rememberMermaidGood(docA, FENCE_FROM, A)
    rememberMermaidGood(docB, FENCE_FROM, B)
    expect(getMermaidLastGood(docA, FENCE_FROM)).toEqual(A)
    expect(getMermaidLastGood(docB, FENCE_FROM)).toEqual(B)
    // B 的 remap 不牵动 A 的条目
    remapMermaidLastGood(docB, insertAt(0, 'new paragraph\n'))
    expect(getMermaidLastGood(docA, FENCE_FROM)).toEqual(A)
  })
})
