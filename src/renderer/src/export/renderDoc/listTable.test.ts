/**
 * export table case — AC-OP-17 表格逐项一致（IT-04 FE-02 缺陷修复回归）。
 *
 * 缺陷：`@lezer/markdown` GFM 对空单元格不产 TableCell 节点（只有相邻
 * TableDelimiter 管道），listTable.renderRow 只数 TableCell → 空列被丢、
 * 行列数缩水、aligns[i] 随错位。本测试钉住：按管道结构数槽位（同
 * editor/table/parse.ts padRow 哨兵补空口径），空单元格输出空 <td>/<th>，
 * 对齐按列序兑现。
 */
import { describe, expect, it } from 'vitest'
import { renderDoc } from './index'

const OPTS = { baseDir: '.', theme: 'light', imageMode: 'relative' } as const

const ROW_RE = /<tr>[\s\S]*?<\/tr>/g

async function rowsOf(markdown: string): Promise<string[]> {
  const html = await renderDoc(markdown, OPTS)
  return html.match(ROW_RE) ?? []
}

describe('renderDoc table empty cells (AC-OP-17)', () => {
  it('keeps full column count when middle/edge cells are empty', async () => {
    const rows = await rowsOf(
      [
        '| 左列 |  | 中列 | 右列 |',
        '| :--- | :---: | :---: | ---: |',
        '| a1 |  | b1 | c1 |',
        '|  |  |  |  |',
        ''
      ].join('\n')
    )
    expect(rows).toHaveLength(3)
    for (const r of rows) {
      expect((r.match(/<t[dh]/g) ?? [])).toHaveLength(4)
    }
  })

  it('renders a fully empty body row as four empty <td> with per-column alignment', async () => {
    const rows = await rowsOf(
      [
        '| 左列 |  | 中列 | 右列 |',
        '| :--- | :---: | :---: | ---: |',
        '|  |  |  |  |',
        ''
      ].join('\n')
    )
    expect(rows[1]).toBe(
      '<tr>' +
        '<td style="text-align:left"></td>' +
        '<td style="text-align:center"></td>' +
        '<td style="text-align:center"></td>' +
        '<td style="text-align:right"></td>' +
        '</tr>'
    )
  })

  it('keeps colon-row alignment indexed by column despite empty cells', async () => {
    const rows = await rowsOf(
      ['| A |  | B |', '| :--- | :---: | ---: |', '|  |  |  |', ''].join('\n')
    )
    expect(rows[0]).toBe(
      '<tr>' +
        '<th style="text-align:left">A</th>' +
        '<th style="text-align:center"></th>' +
        '<th style="text-align:right">B</th>' +
        '</tr>'
    )
  })

  it('pads short body rows to the rectified width (editor padRow parity)', async () => {
    const rows = await rowsOf(
      ['| A | B | C |', '| --- | --- | --- |', '| a |', ''].join('\n')
    )
    expect(rows).toHaveLength(2)
    expect((rows[1].match(/<td/g) ?? [])).toHaveLength(3)
    expect(rows[1]).toContain('<td>a</td>')
    expect(rows[1]).toContain('<td></td>')
  })
})

/**
 * export task checkbox — AC-OP-18 判据 2 任务项勾选态三通道一致（IT-03 PATH-08 P2）。
 *
 * 缺陷：编辑侧完成态判定大小写不敏感（livePreview/handlers-tree.ts
 * isTaskDoneText = `/\[x\]/i`，contextMenu/detect.ts `[ xX]` 同口径），导出侧
 * `marker.includes('x')` 大小写敏感——含 `[X]` 的任务项导出 HTML/PDF/富文本
 * 三通道均渲染未勾选，与编辑视图不一致。本组钉住导出勾选态与编辑侧同口径。
 */
describe('renderDoc task checkbox done-mark (AC-OP-18 判据 2)', () => {
  const CHECKED_RE = /<input type="checkbox" disabled checked>/
  const UNCHECKED_RE = /<input type="checkbox" disabled>/

  async function itemsOf(markdown: string): Promise<string[]> {
    const html = await renderDoc(markdown, OPTS)
    return html.match(/<li>[\s\S]*?<\/li>/g) ?? []
  }

  it('exports the uppercase [X] done-mark as checked (was the defect)', async () => {
    const items = await itemsOf('- [X] upper done\n')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatch(CHECKED_RE)
  })

  it('exports [x] as checked and [ ] as unchecked', async () => {
    const items = await itemsOf(['- [x] lower done', '- [ ] open', ''].join('\n'))
    expect(items).toHaveLength(2)
    expect(items[0]).toMatch(CHECKED_RE)
    expect(items[1]).toMatch(UNCHECKED_RE)
    expect(items[1]).not.toMatch(CHECKED_RE)
  })

  it('keeps per-item checked state across a mixed task list (regression)', async () => {
    const items = await itemsOf(
      ['- [X] upper', '- [x] lower', '- [ ] open', '- [X] upper 2', ''].join('\n')
    )
    expect(items).toHaveLength(4)
    expect(items.map((li) => CHECKED_RE.test(li))).toEqual([true, true, false, true])
    expect(items[2]).toMatch(UNCHECKED_RE)
  })

  it('does not mark a plain list item as a task (no stray checkbox)', async () => {
    const html = await renderDoc('- plain item\n', OPTS)
    expect(html).not.toContain('<input type="checkbox"')
  })
})
