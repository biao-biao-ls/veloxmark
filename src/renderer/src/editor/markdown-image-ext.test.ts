/**
 * markdown-image-ext — Lezer 声明口径（IT-03 FE-04 补齐 align 尾缀）。
 *
 * 判别点是 **Image 节点跨度是否吞掉属性尾缀**：
 *   - 本 tokenizer 声明（有 =WxH 或已知 brace key）→ 跨度含尾缀
 *   - 回落内建 tokenizer（纯 ![a](src) / 未知 brace key）→ 跨度止于 `)`
 * 钉住三条：
 *   1. 既有 `=WxH` / `{flip=}` 声明口径字节不变（不改既有读取语义）
 *   2. `{align=…}` 尾缀被声明进 Image 节点全跨度（写回追加对齐后仍是单节点）
 *   3. 纯 `![a](src)` 与未知 brace key 仍回落内建（尾缀留在节点外）
 */
import { parser } from '@lezer/markdown'
import { describe, expect, it } from 'vitest'
import { imageSizeMarkdown } from './markdown-image-ext'

function imageSpans(src: string): string[] {
  const tree = parser.configure([imageSizeMarkdown]).parse(src)
  const spans: string[] = []
  tree.iterate({
    enter(node) {
      if (node.name === 'Image') spans.push(src.slice(node.from, node.to))
    }
  })
  return spans
}

describe('imageSizeMarkdown（声明口径）', () => {
  it('既有 =WxH 声明跨度不变（吞掉尺寸槽）', () => {
    expect(imageSpans('![cover.png](./cover.png =60x40)')).toEqual([
      '![cover.png](./cover.png =60x40)'
    ])
  })

  it('既有 {flip=} 声明跨度不变（吞掉 flip 尾缀）', () => {
    expect(imageSpans('![a](b.png){flip=hv}')).toEqual(['![a](b.png){flip=hv}'])
  })

  it('{align=} 尾缀声明进 Image 全跨度', () => {
    expect(imageSpans('![a](b.png){align=right}')).toEqual(['![a](b.png){align=right}'])
  })

  it('尺寸 + flip + align 多尾缀任一顺序都声明为单节点', () => {
    const a = '![a](b.png =1x2){flip=h}{align=center}'
    const b = '![a](b.png =1x2){align=center}{flip=h}'
    expect(imageSpans(a)).toEqual([a])
    expect(imageSpans(b)).toEqual([b])
  })

  it('纯 ![a](src) 回落内建 tokenizer', () => {
    expect(imageSpans('![a](b.png)')).toEqual(['![a](b.png)'])
  })

  it('未知 brace key 不吞进节点（保持 P05 行为，尾缀留在外）', () => {
    expect(imageSpans('![a](b.png){foo=bar}')).toEqual(['![a](b.png)'])
  })
})
