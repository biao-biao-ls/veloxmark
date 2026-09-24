import { describe, expect, it } from 'vitest'
import { renderKatexChecked, renderKatexHtml } from './render-helpers'

describe('renderKatexChecked (8C error probe)', () => {
  it('valid TeX → ok: true with the same html as renderKatexHtml', () => {
    const res = renderKatexChecked('x^2', true)
    expect(res.ok).toBe(true)
    expect(res.html).toBe(renderKatexHtml('x^2', true))
    expect(res.html).toContain('katex')
  })

  it('invalid TeX → ok: false, html still KaTeX error markup (non-empty)', () => {
    const res = renderKatexChecked('\\frac{', true)
    expect(res.ok).toBe(false)
    expect(res.html.length).toBeGreaterThan(0)
  })

  it('displayMode passthrough does not affect the ok flag', () => {
    expect(renderKatexChecked('\\sqrt{x}', false).ok).toBe(true)
    expect(renderKatexChecked('\\frac{', false).ok).toBe(false)
  })
})
