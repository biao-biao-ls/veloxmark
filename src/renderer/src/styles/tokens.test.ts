/**
 * Token-constitution guard (IT-01 FE-11, AC-RULE-16).
 *
 * The CSS constitution (CLAUDE.md): `:root` is the single declaration point
 * for theme-independent tokens; theme differences flip values on
 * `.theme-light`/`.theme-dark` (in themes.css) and nothing else. These
 * assertions lock the overlay token base (toast / confirm / grid
 * picker) and keep future partition css from inventing parallel literals or
 * selector-level theme patches:
 *
 *   1. theme block key parity — every theme-split token flips on BOTH sides
 *   2. new overlay vocabulary declares at its constitutional point only
 *   3. zero new `.theme-*` selector patches outside the frozen allowlist
 *   4. bare-value scan — overlay token names never re-assigned outside the
 *      token declaration files (single source, no shadow declarations)
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const stylesDir = fileURLToPath(new URL('.', import.meta.url))

function readStyle(name: string): string {
  return readFileSync(join(stylesDir, name), 'utf8')
}

function styleFiles(): string[] {
  return readdirSync(stylesDir).filter((f) => f.endsWith('.css'))
}

/** Custom property names assigned (`--name:`) inside a css source. */
function declaredVars(source: string): string[] {
  return [...source.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])
}

/** The custom-property names declared inside a named selector block. */
function blockVars(source: string, selector: string): string[] {
  const start = source.indexOf(selector)
  if (start < 0) return []
  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  return declaredVars(source.slice(open + 1, close))
}

/** Custom-property name → value for each declaration in a selector block
 *  (comments stripped first so comment text never shadows a declaration). */
function blockDecls(source: string, selector: string): Map<string, string> {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const start = clean.indexOf(selector)
  const out = new Map<string, string>()
  if (start < 0) return out
  const open = clean.indexOf('{', start)
  const close = clean.indexOf('}', open)
  if (open < 0 || close < 0) return out
  for (const m of clean.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1], m[2].trim())
  }
  return out
}

/** All `var(--x)` custom-property references inside a declaration value. */
function varRefs(value: string): string[] {
  return [...value.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1])
}

/** Files whose stylesheet text contains a .theme-light/.theme-dark selector. */
function themeSelectorFiles(): string[] {
  return styleFiles().filter((f) =>
    /\.theme-(light|dark)\b/.test(readStyle(f).replace(/\/\*[\s\S]*?\*\//g, ''))
  )
}

// Tokens owned by the FE-11 overlay base + the IT-03 FE-01 render-zone
// vocabulary. Theme-split (values flip per theme, declared in themes.css):
// toast surface family, strong accent tint (grid selected cells), danger soft
// fill (danger menu-item hover), the render-zone float/handle/indicator
// family (--float-bg, --float-border, --handle-accent, --drop-indicator,
// --summary-fg, --on-accent, --accent-soft), and the FE-10 error-bar family
// (--errbar-fg/--errbar-bg/--errbar-border).
// (--shadow-menu: menu-face elevation, re-declared by 批 C for .menu-dropdown —
// not part of the overlay family; see themes.css comment.)
const THEME_SPLIT_OVERLAY_TOKENS = [
  '--toast-bg',
  '--toast-fg',
  '--toast-border',
  '--toast-accent',
  '--accent-soft-strong',
  '--danger-soft',
  // IT-03 FE-01 render-zone theme-split family (REN-render-zone token contract)
  '--float-bg',
  '--float-border',
  '--handle-accent',
  '--drop-indicator',
  '--summary-fg',
  '--on-accent',
  '--accent-soft',
  // IT-03 FE-10 error-bar family (themes.css:93-95/160-162)
  '--errbar-fg',
  '--errbar-bg',
  '--errbar-border'
] as const

// Theme-independent geometry (declared once in tokens.css :root): overlay grid
// metrics + the IT-03 FE-01 render-zone support tokens
// (--chrome-duration/--border-width/--text-ui/--text-body/--z-float) and the
// drag-handle glyph tracking (--handle-tracking, letter-spacing tokenization).
const ROOT_OVERLAY_TOKENS = [
  '--grid-cell-size',
  '--grid-cell-gap',
  '--chrome-duration',
  '--border-width',
  '--text-ui',
  '--text-body',
  '--z-float',
  '--handle-tracking'
] as const

const ALL_OVERLAY_TOKENS = [...THEME_SPLIT_OVERLAY_TOKENS, ...ROOT_OVERLAY_TOKENS]

/**
 * Legacy debt allowlist for selector-level theme patches. New code flips token
 * values in themes.css only (AC-RULE-16: zero new .theme-dark patches) — any
 * file outside this list appearing here is a new constitutional violation.
 */
const THEME_SELECTOR_ALLOWLIST = [
  'themes.css',
  'buttons.css', // legacy: .btn-primary hover skin (1B)
  'markdown.css', // legacy: callout --co-bar/--co-bg component-private family
  'overlays.css' // legacy: .list-pick-item.is-active skin
]

describe('overlay token base (IT-01 FE-11)', () => {
  it('theme blocks flip exactly the same token set (AC-RULE-16: 仅翻值)', () => {
    const themes = readStyle('themes.css')
    const light = blockVars(themes, '.theme-light')
    const dark = blockVars(themes, '.theme-dark')
    const missingInDark = light.filter((k) => !dark.includes(k))
    const missingInLight = dark.filter((k) => !light.includes(k))
    expect(missingInDark, `theme-split tokens missing in .theme-dark: ${missingInDark.join(', ')}`).toEqual([])
    expect(missingInLight, `theme-split tokens missing in .theme-light: ${missingInLight.join(', ')}`).toEqual([])
  })

  it('theme-split overlay tokens are declared on both theme sides only', () => {
    const themes = readStyle('themes.css')
    const light = blockVars(themes, '.theme-light')
    const dark = blockVars(themes, '.theme-dark')
    for (const token of THEME_SPLIT_OVERLAY_TOKENS) {
      expect(light, `${token} must be declared in .theme-light`).toContain(token)
      expect(dark, `${token} must be declared in .theme-dark`).toContain(token)
    }
    // No shadow declarations outside themes.css (single declaration point).
    for (const file of styleFiles()) {
      if (file === 'themes.css') continue
      const declared = declaredVars(readStyle(file))
      for (const token of THEME_SPLIT_OVERLAY_TOKENS) {
        expect(declared, `${token} must not be declared in ${file}`).not.toContain(token)
      }
    }
  })

  it('theme-independent overlay geometry is declared once in tokens.css :root', () => {
    const tokens = readStyle('tokens.css')
    for (const token of ROOT_OVERLAY_TOKENS) {
      const occurrences = declaredVars(tokens).filter((k) => k === token)
      expect(occurrences.length, `${token} must be declared exactly once in tokens.css`).toBe(1)
    }
    for (const file of styleFiles()) {
      if (file === 'tokens.css') continue
      const declared = declaredVars(readStyle(file))
      for (const token of ROOT_OVERLAY_TOKENS) {
        expect(declared, `${token} must not be declared in ${file}`).not.toContain(token)
      }
    }
  })

  it('zero new selector-level .theme-* patches (AC-RULE-16)', () => {
    const offenders = themeSelectorFiles().filter((f) => !THEME_SELECTOR_ALLOWLIST.includes(f))
    expect(offenders, `new theme-selector patches in: ${offenders.join(', ')}`).toEqual([])
  })

  it('bare-value scan: overlay vocabulary has no shadow raw-value assignments', () => {
    // A `--toast-bg: #…`-style assignment outside the token files is a shadow
    // declaration that bypasses the constitutional flip points.
    const violations: string[] = []
    for (const file of styleFiles()) {
      if (file === 'tokens.css' || file === 'themes.css') continue
      const text = readStyle(file)
      for (const token of ALL_OVERLAY_TOKENS) {
        if (new RegExp(`\\${token}\\s*:`).test(text)) {
          violations.push(`${token} in ${file}`)
        }
      }
    }
    expect(violations, `shadow token declarations: ${violations.join(', ')}`).toEqual([])
  })
})

// r2 FE-03/FE-05 (CHANGE-16): the --focus-ring token chain broke because
// `:root` declared `0 0 0 1px var(--accent)` while --accent existed only in
// the theme blocks — substitution at :root's computed-value time failed and
// every `box-shadow: var(--focus-ring)` consumer rendered nothing. These
// assertions lock the two halves of the fix: chain completeness at :root,
// and theme-side re-declaration of composed tokens so they re-resolve per
// theme (a :root-only composition bakes the light accent into the dark ring).
describe('root token var() chain (r2 FE-03/FE-05)', () => {
  it('every var() referenced by a :root-declared token is itself declared in :root', () => {
    const rootDecls = blockDecls(readStyle('tokens.css'), ':root')
    const broken: string[] = []
    for (const [name, value] of rootDecls) {
      for (const ref of varRefs(value)) {
        if (!rootDecls.has(ref)) broken.push(`${name} → ${ref}`)
      }
    }
    expect(broken, `:root tokens referencing vars undeclared at :root: ${broken.join(', ')}`).toEqual([])
  })

  it('root tokens that reference theme-flipped tokens re-declare on both theme sides', () => {
    const rootDecls = blockDecls(readStyle('tokens.css'), ':root')
    const light = blockDecls(readStyle('themes.css'), '.theme-light')
    const dark = blockDecls(readStyle('themes.css'), '.theme-dark')
    const themeSplit = new Set([...light.keys(), ...dark.keys()])
    const missing: string[] = []
    for (const [name, value] of rootDecls) {
      const refsThemeSplit = varRefs(value).some((ref) => themeSplit.has(ref))
      if (!refsThemeSplit) continue
      if (!light.has(name) || !dark.has(name)) missing.push(name)
    }
    expect(
      missing,
      `composed root tokens referencing theme-split vars must re-declare in .theme-light AND .theme-dark: ${missing.join(', ')}`
    ).toEqual([])
  })
})

// ---- FE-01 「零裸值」契约口径收窄（IT-03 FE-01 code-review 必修 5）-----------
// render-zone.css 的「零裸值」契约按契约类范围收窄：FE-01 自有声明（浮层/把手/
// 指示线/折叠 chrome，token 化后消费 var()）必须零裸 px；下列 8 处裸 px 属兄弟
// 任务、已路由各自收口批，FE-01 批不动，登记为例外（grep 守护对其声称范围全绿）：
//   height: 18px                — .img-toolbar .tb-sep 短分隔条（ui_06 常量）→ FE-04 batch-J
//   inset: -1px                 — .cm-md-image-wrap 编辑态外描边             → FE-04 batch-J
//   font-size: 11px / width: 18px / height: 18px — h1–h2 折叠 caret 几何    → FE-07 heading-caret
//   font-size: 9px  / width: 14px / height: 14px — h3–h6 折叠 caret 几何    → FE-07 heading-caret
// 除上列例外（declarations 逐条命中）外，render-zone.css 声明值中不得出现裸 px；
// 裸色值（hex）恒为 0，无例外。
const RENDER_ZONE_BARE_PX_ALLOWLIST = [
  'height: 18px',
  'inset: -1px',
  'font-size: 11px',
  'width: 18px',
  'font-size: 9px',
  'width: 14px',
  'height: 14px'
] as const

describe('render-zone bare-px gate (IT-03 FE-01, scope-narrowed)', () => {
  it('bare-px scan: FE-01 declarations are clean; only registered sibling-task exceptions remain', () => {
    const text = readStyle('render-zone.css').replace(/\/\*[\s\S]*?\*\//g, '')
    const violations: string[] = []
    for (const m of text.matchAll(/([a-zA-Z-]+)\s*:\s*([^;{}]+);/g)) {
      if (!/[0-9.]+px/.test(m[2])) continue
      const decl = `${m[1]}: ${m[2].trim()}`
      if (!(RENDER_ZONE_BARE_PX_ALLOWLIST as readonly string[]).includes(decl)) {
        violations.push(decl)
      }
    }
    expect(
      violations,
      `unregistered bare px in render-zone.css (register sibling-task leftovers in RENDER_ZONE_BARE_PX_ALLOWLIST only): ${violations.join('; ')}`
    ).toEqual([])
  })

  it('bare-color scan: render-zone.css declares zero hex values', () => {
    const text = readStyle('render-zone.css').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([])
  })
})
