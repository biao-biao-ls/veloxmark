import { describe, expect, it } from 'vitest'
import {
  collectImageSrcs,
  faultNextHtmlTransformOnce,
  htmlToMarkdown,
  htmlToMarkdownSafe
} from './htmlToMd'

describe('htmlToMarkdown — inline', () => {
  it('converts headings, paragraphs and line breaks', () => {
    const md = htmlToMarkdown('<h1>Title</h1><p>para one</p><p>line a<br>line b</p>')
    expect(md).toBe('# Title\n\npara one\n\nline a  \nline b')
  })

  it('converts strong/em/del/code', () => {
    const md = htmlToMarkdown('<p><strong>bold</strong> and <em>it</em> and <del>gone</del> and <code>x=1</code></p>')
    expect(md).toBe('**bold** and *it* and ~~gone~~ and `x=1`')
  })

  it('lengthens code delimiters when content contains backticks', () => {
    const md = htmlToMarkdown('<p><code>a`b</code></p>')
    expect(md).toBe('``a`b``')
  })

  it('converts anchors; empty text falls back to the href', () => {
    const md = htmlToMarkdown('<p><a href="https://example.com">site</a> <a href="https://x.y"></a></p>')
    expect(md).toBe('[site](https://example.com) [https://x.y](https://x.y)')
  })

  it('keeps img as markdown image', () => {
    const md = htmlToMarkdown('<p><img src="https://a.b/x.png" alt="pic"></p>')
    expect(md).toBe('![pic](https://a.b/x.png)')
  })

  it('ignores style/class attributes', () => {
    const md = htmlToMarkdown('<p class="x" style="color:red"><strong style="font-weight:900">b</strong></p>')
    expect(md).toBe('**b**')
  })

  it('decodes entities', () => {
    const md = htmlToMarkdown('<p>a &amp; b &lt;c&gt; &#65;</p>')
    expect(md).toBe('a & b <c> A')
  })
})

describe('htmlToMarkdown — lists / quotes / hr', () => {
  it('converts ul with nested ol', () => {
    const md = htmlToMarkdown('<ul><li>one</li><li>two<ol><li>sub a</li><li>sub b</li></ol></li></ul>')
    expect(md).toBe('- one\n- two\n  1. sub a\n  2. sub b')
  })

  it('converts ol with start attr', () => {
    const md = htmlToMarkdown('<ol start="3"><li>c</li><li>d</li></ol>')
    expect(md).toBe('3. c\n4. d')
  })

  it('flattens block content inside li to marker line + indented continuation', () => {
    const md = htmlToMarkdown('<ul><li><p>first</p><p>second</p></li></ul>')
    expect(md).toContain('- first')
    expect(md).toContain('second')
  })

  it('converts nested blockquote with > prefixes', () => {
    const md = htmlToMarkdown('<blockquote><p>outer</p><blockquote><p>inner</p></blockquote></blockquote>')
    expect(md).toBe('> outer\n>\n> > inner')
  })

  it('converts hr to ---', () => {
    const md = htmlToMarkdown('<p>a</p><hr><p>b</p>')
    expect(md).toBe('a\n\n---\n\nb')
  })
})

describe('htmlToMarkdown — tables / code blocks', () => {
  it('converts a thead+tbody table to GFM via formatTable', () => {
    const md = htmlToMarkdown(
      '<table><thead><tr><th>Name</th><th>Age</th></tr></thead>' +
        '<tbody><tr><td>Ann</td><td>3</td></tr><tr><td>Bob</td><td>5</td></tr></tbody></table>'
    )
    const lines = md.split('\n')
    expect(lines[0]).toMatch(/^\| Name\s+\| Age\s+\|$/)
    expect(lines[1]).toMatch(/^\| -+\s+\| -+\s+\|$/)
    expect(lines[2]).toMatch(/^\| Ann\s+\| 3\s+\|$/)
    expect(lines[3]).toMatch(/^\| Bob\s+\| 5\s+\|$/)
  })

  it('honors th align attributes', () => {
    const md = htmlToMarkdown(
      '<table><tr><th align="left">L</th><th align="center">C</th><th align="right">R</th></tr>' +
        '<tr><td>1</td><td>2</td><td>3</td></tr></table>'
    )
    const delim = md.split('\n')[1]
    expect(delim).toContain(':---')
    expect(delim).toContain(':---:')
    expect(delim).toContain('---:')
  })

  it('escapes pipes inside cells', () => {
    const md = htmlToMarkdown('<table><tr><th>H</th></tr><tr><td>a|b</td></tr></table>')
    expect(md).toContain('a\\|b')
  })

  it('converts pre>code with language class to a fence', () => {
    const md = htmlToMarkdown('<pre><code class="language-js">const x = 1\n</code></pre>')
    expect(md).toBe('```js\nconst x = 1\n```')
  })

  it('fences bare pre without a language', () => {
    const md = htmlToMarkdown('<pre>plain\nblock</pre>')
    expect(md).toBe('```\nplain\nblock\n```')
  })
})

describe('htmlToMarkdown — drops and unwraps', () => {
  it('drops script/style/iframe with their content', () => {
    const md = htmlToMarkdown(
      '<p>ok</p><script>alert(1)</script><style>p{color:red}</style><iframe src="x"></iframe><p>fine</p>'
    )
    expect(md).toBe('ok\n\nfine')
    expect(md).not.toContain('alert')
    expect(md).not.toContain('color')
    expect(md).not.toContain('iframe')
  })

  it('unwraps unknown tags to their text', () => {
    const md = htmlToMarkdown('<article><custom-el><p>inner</p></custom-el></article>')
    expect(md).toBe('inner')
  })

  it('treats browser fragment wrappers (html/body/comments) transparently', () => {
    const md = htmlToMarkdown(
      '<html><body><!--StartFragment--><h2>Sec</h2><p>body text</p><!--EndFragment--></body></html>'
    )
    expect(md).toBe('## Sec\n\nbody text')
  })

  it('handles unclosed tags without throwing', () => {
    const md = htmlToMarkdown('<p>open <strong>bold')
    expect(md).toContain('open')
    expect(md).toContain('**bold**')
  })

  it('htmlToMarkdownSafe returns null only on hard failure paths (never throws)', () => {
    expect(htmlToMarkdownSafe('<p>fine</p>')).toBe('fine')
    expect(typeof htmlToMarkdownSafe('<<<>>>')).toBe('string')
  })
})

// UX-P19 wave⑥-4 F2: throw→plain fallback contract, unit-injected half.
describe('htmlToMarkdown throw seam — P19 fallback contract', () => {
  it('fault injection: Safe returns null on throw, never propagates', () => {
    faultNextHtmlTransformOnce()
    expect(htmlToMarkdownSafe('<p>about to throw</p>')).toBeNull()
  })

  it('fault injection is one-shot — next conversion succeeds', () => {
    faultNextHtmlTransformOnce()
    expect(htmlToMarkdownSafe('<p>first</p>')).toBeNull()
    expect(htmlToMarkdownSafe('<p>second</p>')).toBe('second')
    expect(htmlToMarkdown('<p>third</p>')).toBe('third')
  })

  it('empty conversion is empty string, not throw — silent fall-through branch', () => {
    // Pure script/style payload: parser drops subtrees → zero markdown.
    const pure = '<script>window.x = 1</scr' + 'ipt><style>a{}</style>'
    expect(htmlToMarkdown(pure)).toBe('')
    expect(htmlToMarkdownSafe(pure)).toBe('')
  })
})

describe('collectImageSrcs', () => {
  it('lists image srcs from converted markdown', () => {
    const md = 'a ![x](https://a/b.png) and ![y](./local.jpg)'
    expect(collectImageSrcs(md)).toEqual(['https://a/b.png', './local.jpg'])
  })
})
