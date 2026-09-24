import { describe, expect, it } from 'vitest'
import { codeBlockHtml } from './code'

// ---- 9B: exported code-block shape (no language bar — idle-look parity) ------

describe('codeBlockHtml', () => {
  it('renders the bare rounded-box shape with highlight passthrough (9B)', () => {
    // Exact shape pin: no language label even when lang is set.
    expect(codeBlockHtml('ts', 'X<Y')).toBe(
      '<div class="export-code"><pre><code class="hljs">X<Y</code></pre></div>'
    )
  })

  it('empty lang keeps the same shape (indented-code path)', () => {
    expect(codeBlockHtml('', 'plain &')).toBe(
      '<div class="export-code"><pre><code class="hljs">plain &</code></pre></div>'
    )
  })
})
