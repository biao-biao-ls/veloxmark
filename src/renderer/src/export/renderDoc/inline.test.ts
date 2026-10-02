/**
 * export Image case — AC-OP-18 图片段（IT-03 FE-04）。
 *
 * 导出三通道（HTML/PDF/复制富文本）共用 renderDoc，图片的尺寸/对齐/翻转
 * 必须与编辑器同口径：
 *   - `=WxH` 落 width/height 属性（P05 口径）
 *   - `{align=…}` 落 fit-content block 放置的 inline style（与编辑器
 *     `.cm-md-image-align-*` 的 auto-margin 放置等价）
 *   - `{flip=…}` 落 CSS transform（P05 口径）
 * imageMode: 'relative' 时 src 原样输出，不触 window.api —— 纯函数可测。
 */
import { describe, expect, it } from 'vitest'
import { renderDoc } from './index'

const OPTS = { baseDir: '.', theme: 'light', imageMode: 'relative' } as const

async function imgOf(markdown: string): Promise<string> {
  const html = await renderDoc(markdown, OPTS)
  const m = /<img[^>]*>/.exec(html)
  if (!m) throw new Error(`no <img> in export html: ${html}`)
  return m[0]
}

describe('renderDoc image export (AC-OP-18)', () => {
  it('keeps the =WxH size attribute on export', async () => {
    const img = await imgOf('![cover](logo.png =360x240)')
    expect(img).toContain('width="360"')
    expect(img).toContain('height="240"')
    expect(img).toContain('src="logo.png"')
  })

  it('{align=center} exports as auto-margin block placement', async () => {
    const img = await imgOf('![a](b.png){align=center}')
    expect(img).toContain('style="display:block;margin-left:auto;margin-right:auto"')
  })

  it('{align=right}/{align=left} export the matching margins', async () => {
    expect(await imgOf('![a](b.png){align=right}')).toContain(
      'style="display:block;margin-left:auto;margin-right:0"'
    )
    expect(await imgOf('![a](b.png){align=left}')).toContain(
      'style="display:block;margin-left:0;margin-right:auto"'
    )
  })

  it('size + flip + align survive together in one img tag', async () => {
    const img = await imgOf('![a](b.png =10x20){flip=h}{align=center}')
    expect(img).toContain('width="10"')
    expect(img).toContain('height="20"')
    expect(img).toContain('transform:scaleX(-1)')
    expect(img).toContain('display:block;margin-left:auto;margin-right:auto')
  })

  it('unattributed image gets no style/size chrome', async () => {
    const img = await imgOf('![plain](p.png)')
    expect(img).not.toContain('style=')
    expect(img).not.toContain('width=')
    expect(img).toContain('alt="plain"')
  })
})
