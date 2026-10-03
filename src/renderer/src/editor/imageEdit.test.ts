/**
 * imageEdit — .md 图片语法写回纯函数（IT-03 FE-04，契约面 ren-image:write-md）。
 *
 * 三条任务点名判据（FE-04 阶段 1）：
 *   1. 尺寸改写保对齐
 *   2. 对齐改写保尺寸
 *   3. 无尺寸字段图片补字段
 * 另钉住：flip/src/alt/title 字节保真、双向不串扰、parse 读语义向后兼容。
 */
import { describe, expect, it } from 'vitest'
import { parseImageMarkdown } from './image-parse'
import {
  isValidImageSrc,
  renderImageMarkdown,
  rewriteImageAlign,
  rewriteImageFlip,
  rewriteImageSize,
  rewriteImageSrc
} from './imageEdit'

describe('parseImageMarkdown（读语义补齐，既有口径不变）', () => {
  it('既有 =WxH 像素语义保持不变', () => {
    expect(parseImageMarkdown('![cover.png](./cover.png =60x40)')).toEqual({
      alt: 'cover.png',
      src: './cover.png',
      width: 60,
      height: 40
    })
  })

  it('无属性图片解析出 alt/src', () => {
    expect(parseImageMarkdown('![a](b.png)')).toEqual({ alt: 'a', src: 'b.png' })
  })

  it('补齐 align 字段读取', () => {
    expect(parseImageMarkdown('![a](b.png =10x20){align=right}')?.align).toBe('right')
  })

  it('补齐 title 读取（写回保真需要）', () => {
    expect(parseImageMarkdown('![a](b.png "the title" =10x20)')?.title).toBe('the title')
  })

  it('align 与 flip 可共存，顺序无关', () => {
    const a = parseImageMarkdown('![a](b.png){flip=h}{align=center}')
    const b = parseImageMarkdown('![a](b.png){align=center}{flip=h}')
    expect(a?.align).toBe('center')
    expect(a?.flip).toBe('h')
    expect(b?.align).toBe('center')
    expect(b?.flip).toBe('h')
  })
})

describe('rewriteImageSize（尺寸改写保对齐）', () => {
  it('改尺寸时对齐字段原样保留', () => {
    expect(
      rewriteImageSize('![cover.png](./cover.png =60x40){align=center}', {
        width: 120,
        height: 80
      })
    ).toBe('![cover.png](./cover.png =120x80){align=center}')
  })

  it('改尺寸时对齐与 flip 同时保留', () => {
    expect(
      rewriteImageSize('![a](b.png =1x2){flip=hv}{align=right}', { width: 3, height: 4 })
    ).toBe('![a](b.png =3x4){flip=hv}{align=right}')
  })

  it('无尺寸字段图片补字段', () => {
    expect(rewriteImageSize('![cover.png](./cover.png)', { width: 120, height: 80 })).toBe(
      '![cover.png](./cover.png =120x80)'
    )
  })

  it('无尺寸但有对齐时补尺寸，对齐不变', () => {
    expect(
      rewriteImageSize('![a](b.png){align=right}', { width: 120, height: 80 })
    ).toBe('![a](b.png =120x80){align=right}')
  })

  it('title/alt/src 字节保真', () => {
    expect(
      rewriteImageSize('![alt text](./img.png "cap" =10x20)', { width: 1, height: 2 })
    ).toBe('![alt text](./img.png "cap" =1x2)')
  })

  it('传 null 清除尺寸字段', () => {
    expect(rewriteImageSize('![a](b.png =10x20){align=left}', null)).toBe(
      '![a](b.png){align=left}'
    )
  })

  it('非法语法返回 null（不写回）', () => {
    expect(rewriteImageSize('not an image', { width: 1, height: 2 })).toBeNull()
  })
})

describe('rewriteImageAlign（对齐改写保尺寸）', () => {
  it('改对齐时尺寸字段原样保留', () => {
    expect(rewriteImageAlign('![cover.png](./cover.png =60x40)', 'center')).toBe(
      '![cover.png](./cover.png =60x40){align=center}'
    )
  })

  it('改对齐时已有对齐被替换、尺寸不变', () => {
    expect(rewriteImageAlign('![a](b.png =60x40){align=left}', 'right')).toBe(
      '![a](b.png =60x40){align=right}'
    )
  })

  it('改对齐时 flip/title/alt/src 保真', () => {
    expect(rewriteImageAlign('![alt](b.png "t" =1x2){flip=h}', 'right')).toBe(
      '![alt](b.png "t" =1x2){flip=h}{align=right}'
    )
  })

  it('无尺寸字段图片补对齐不引入尺寸', () => {
    expect(rewriteImageAlign('![a](b.png)', 'center')).toBe('![a](b.png){align=center}')
  })

  it('传 null 清除对齐字段', () => {
    expect(rewriteImageAlign('![a](b.png =1x2){align=right}', null)).toBe(
      '![a](b.png =1x2)'
    )
  })

  it('非法语法返回 null（不写回）', () => {
    expect(rewriteImageAlign('not an image', 'center')).toBeNull()
  })
})

describe('rewriteImageFlip（flip 改写保尺寸/对齐）', () => {
  it('改 flip 时尺寸与对齐原样保留', () => {
    expect(rewriteImageFlip('![a](b.png =60x40){align=center}', 'hv')).toBe(
      '![a](b.png =60x40){align=center}{flip=hv}'
    )
  })

  it('替换已有 flip 时对齐不变', () => {
    expect(rewriteImageFlip('![a](b.png =60x40){flip=h}{align=right}', 'v')).toBe(
      '![a](b.png =60x40){align=right}{flip=v}'
    )
  })

  it('传 null 清除 flip 字段', () => {
    expect(rewriteImageFlip('![a](b.png){flip=h}', null)).toBe('![a](b.png)')
  })
})

describe('rewriteImageSrc（编辑地址改写保尺寸/对齐/flip）', () => {
  it('改 src 时尺寸与对齐尾缀原样保留', () => {
    expect(rewriteImageSrc('![cover.png](./cover.png =60x40){align=center}', './new.png')).toBe(
      '![cover.png](./new.png =60x40){align=center}'
    )
  })

  it('改 src 时 alt/title/flip/align 字节保真', () => {
    expect(
      rewriteImageSrc('![alt text](bad.png "cap" =1x2){flip=hv}{align=right}', 'good.png')
    ).toBe('![alt text](good.png "cap" =1x2){flip=hv}{align=right}')
  })

  it('无尺寸无属性图片只动 src 槽', () => {
    expect(rewriteImageSrc('![a](b.png)', 'c.png')).toBe('![a](c.png)')
  })

  it('src 前空白原样保留（外科式不重整排版）', () => {
    expect(rewriteImageSrc('![a](  b.png)', 'c.png')).toBe('![a](  c.png)')
  })

  it('非法新 src 拒绝（空白/括号/控制字符/空串）', () => {
    const text = '![a](b.png)'
    expect(rewriteImageSrc(text, '')).toBeNull()
    expect(rewriteImageSrc(text, 'a b.png')).toBeNull()
    expect(rewriteImageSrc(text, 'a)b.png')).toBeNull()
    expect(rewriteImageSrc(text, `a${String.fromCharCode(7)}b.png`)).toBeNull()
  })

  it('非法语法返回 null（不写回）', () => {
    expect(rewriteImageSrc('not an image', 'c.png')).toBeNull()
    expect(rewriteImageSrc('[link](b.png)', 'c.png')).toBeNull()
  })

  it('改 src 不影响其它 writer 的槽位', () => {
    const rewritten = rewriteImageSrc('![a](b.png =10x20){align=left}', 'c.png')
    expect(rewritten).toBe('![a](c.png =10x20){align=left}')
    expect(rewriteImageSize(rewritten!, { width: 1, height: 2 })).toBe(
      '![a](c.png =1x2){align=left}'
    )
    expect(rewriteImageAlign(rewritten!, 'right')).toBe('![a](c.png =10x20){align=right}')
  })
})

describe('isValidImageSrc（src 槽承载力）', () => {
  it('普通相对/远程 src 通过', () => {
    expect(isValidImageSrc('./a.png')).toBe(true)
    expect(isValidImageSrc('https://x.com/a.png?v=1')).toBe(true)
    expect(isValidImageSrc('mdres://image?path=%2Fa.png')).toBe(true)
  })

  it('空串/空白/`)`/控制字符拒绝', () => {
    expect(isValidImageSrc('')).toBe(false)
    expect(isValidImageSrc(' ')).toBe(false)
    expect(isValidImageSrc('a b')).toBe(false)
    expect(isValidImageSrc('a)b')).toBe(false)
    expect(isValidImageSrc('a\tb')).toBe(false)
    expect(isValidImageSrc(`a${String.fromCharCode(7)}b`)).toBe(false)
  })
})

describe('renderImageMarkdown（解析结果重组，写回口径单源）', () => {
  it('完整字段重组', () => {
    expect(
      renderImageMarkdown({
        alt: 'a',
        src: 'b.png',
        title: 't',
        width: 1,
        height: 2,
        align: 'right',
        flip: 'hv'
      })
    ).toBe('![a](b.png "t" =1x2){flip=hv}{align=right}')
  })

  it('最小字段重组', () => {
    expect(renderImageMarkdown({ alt: 'a', src: 'b.png' })).toBe('![a](b.png)')
  })
})
