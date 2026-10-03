/**
 * Sidebar token-audit guard (IT-02 FE-10, AC-FN-12 / UI-ELEM-01).
 *
 * The CSS constitution (CLAUDE.md): spacing/radius consume `--space-*` /
 * `--radius-*`, theme differences flip token values on `.theme-light` /
 * `.theme-dark` only, and partitions never restate bare px. The sidebar
 * partitions (chrome.css sidebar/outline rules, filetree.css, the
 * `.outline-fold` triangle in markdown.css) plus FileTree's row indent are
 * scanned here so the audit result is machine-checkable:
 *
 *   1. sidebar metrics declare at their constitutional point only (tokens.css)
 *   2. bare-px scan — zero numeric px in sidebar rule bodies (exemptions listed)
 *   3. bare-color scan — sidebar rule bodies consume color tokens, no literals
 *   4. FileTree row indent rides tokens (--tree-indent * (depth + 1), ui_05
 *      16px/级), no numeric-px inline paddingLeft
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const stylesDir = fileURLToPath(new URL('.', import.meta.url))

function readStyle(name: string): string {
  return readFileSync(join(stylesDir, name), 'utf8')
}

/** Custom property names assigned (`--name:`) inside a css source. */
function declaredVars(source: string): string[] {
  return [...source.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])
}

interface CssRule {
  selector: string
  body: string
}

/** Flat selector{body} rules (no at-rules in the scanned files). */
function rules(source: string): CssRule[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: CssRule[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(stripped)) !== null) {
    out.push({ selector: m[1].trim(), body: m[2] })
  }
  return out
}

/** Sidebar-family selectors: panel chrome, tree/outline rows, their popups. */
const SIDEBAR_SELECTOR = /(^|[\s,>+~(])\.(sidebar|outline|filetree|tree-menu)[\w-]*/

function sidebarRuleBodies(file: string): string[] {
  return rules(readStyle(file))
    .filter((r) => SIDEBAR_SELECTOR.test(r.selector))
    .map((r) => r.body)
}

/** Property-value px literals — token declarations (--x: 3px) are excluded. */
function barePx(body: string): string[] {
  const hits: string[] = []
  for (const decl of body.split(';')) {
    const prop = decl.slice(0, decl.indexOf(':') + 1)
    if (/--[\w-]+\s*:$/.test(prop.trim())) continue // token declaration
    for (const m of decl.matchAll(/(-?\d+(?:\.\d+)?)px/g)) hits.push(m[0])
  }
  return hits
}

function bareColors(body: string): string[] {
  const hits: string[] = []
  for (const decl of body.split(';')) {
    const prop = decl.slice(0, decl.indexOf(':') + 1)
    if (/--[\w-]+\s*:$/.test(prop.trim())) continue
    for (const m of decl.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)) hits.push(m[0])
  }
  return hits
}

// Metrics owned by the FE-10 sidebar audit. Theme-independent geometry —
// declared once in tokens.css :root (same constitutional point as the
// --img-resize-* / --grid-cell-* families).
const SIDEBAR_ROOT_TOKENS = [
  '--sidebar-width',
  '--tree-row-h',
  '--tree-indent',
  '--tree-accent-bar',
  '--outline-lv-w',
  '--active-bar-w',
  '--active-bar-inset',
  '--active-bar-radius',
  '--sidebar-back-bleed',
  '--dot-size',
  '--ops-menu-min-w',
  '--ops-menu-max-h',
  '--tree-menu-min-w',
  '--tree-menu-item-pad-y',
  '--tree-menu-item-pad-x',
  '--hit-box-sm',
  '--hit-box-md',
  '--hit-box-lg',
  '--hit-box-xl',
  '--space-half',
  '--space-hairline',
  '--text-glyph',
  '--text-micro',
  '--text-caption',
  '--text-meta',
  '--text-icon'
] as const

describe('sidebar token audit (IT-02 FE-10)', () => {
  it('sidebar metrics are declared once in tokens.css :root and never shadowed', () => {
    const tokens = declaredVars(readStyle('tokens.css'))
    for (const token of SIDEBAR_ROOT_TOKENS) {
      expect(
        tokens.filter((k) => k === token).length,
        `${token} must be declared exactly once in tokens.css`
      ).toBe(1)
    }
    for (const file of ['chrome.css', 'filetree.css', 'markdown.css', 'themes.css']) {
      const declared = declaredVars(readStyle(file))
      for (const token of SIDEBAR_ROOT_TOKENS) {
        expect(declared, `${token} must not be declared in ${file}`).not.toContain(token)
      }
    }
  })

  it('bare-px scan: sidebar rule bodies carry zero numeric px', () => {
    const violations: string[] = []
    for (const file of ['chrome.css', 'filetree.css', 'markdown.css']) {
      for (const body of sidebarRuleBodies(file)) {
        for (const hit of barePx(body)) violations.push(`${file}: ${hit}`)
      }
    }
    expect(violations, `bare px in sidebar rules: ${violations.join(', ')}`).toEqual([])
  })

  it('bare-color scan: sidebar rule bodies consume color tokens only', () => {
    const violations: string[] = []
    for (const file of ['chrome.css', 'filetree.css', 'markdown.css']) {
      for (const body of sidebarRuleBodies(file)) {
        for (const hit of bareColors(body)) violations.push(`${file}: ${hit}`)
      }
    }
    expect(violations, `bare colors in sidebar rules: ${violations.join(', ')}`).toEqual([])
  })

  it('FileTree row indent rides tokens — no numeric-px inline paddingLeft', () => {
    const tsx = readFileSync(join(stylesDir, '..', 'components', 'FileTree.tsx'), 'utf8')
    expect(tsx).not.toMatch(/paddingLeft:\s*[\d.]+/)
  })
})
