import { tags as t } from '@lezer/highlight'
import type { TagStyle } from '@codemirror/language'

// ---- syntax color single source of truth (step ②) ---------------------------
// One map of code-token colors (VSCode Light+ / Dark+ values), materialized
// twice so the dual-state same-shell contract holds (colors never jump when
// entering/leaving a focused panel):
//   (a)  hljsCss()/texCss()  — CSS text for the rendered widget + export
//        surfaces (hljs class vocabulary) and the focused math panel
//        (.cm-md-tex-* classes);
//   (b)  codeTagStyles()     — HighlightStyle entries (@lezer/highlight tags)
//        for the CM edit-state / source-mode highlighting.
// Never hand-edit token hexes in theme.ts or CSS files — change them here.
//
// CSS generation contract: emit ONLY bare `.hljs` / `.hljs-*` selectors.
// Consumers string-replace `.hljs` → `${scope} .hljs` (injectScopedCss /
// scopedHljsCss); compound selectors like `code.hljs` would be mangled into
// dead selectors by that replace. Keep the bare-selector rule.

export type ColorTheme = 'light' | 'dark'

export interface TokenColor {
  color: string
  fontStyle?: 'italic' | 'bold' | 'normal'
}

export type TokenKey =
  | 'comment'
  | 'keyword'
  | 'operator'
  | 'punctuation'
  | 'string'
  | 'regexp'
  | 'escape'
  | 'number'
  | 'bool'
  | 'atom'
  | 'type'
  | 'class'
  | 'namespace'
  | 'function'
  | 'property'
  | 'variable'
  | 'constant'
  | 'builtin'
  | 'attribute'
  | 'tag'
  | 'meta'
  | 'invalid'
  | 'inserted'
  | 'deleted'
  | 'link'
  // step ④: focused math panel (.cm-md-tex-*)
  | 'mathCommand'
  | 'mathBrace'
  | 'mathOp'
  | 'mathNumber'
  | 'mathComment'

// VSCode Light+ / Dark+ (editor.tokenColorCustomizations defaults).
export const LIGHT: Record<TokenKey, TokenColor> = {
  comment: { color: '#008000', fontStyle: 'italic' },
  keyword: { color: '#0000ff' },
  operator: { color: '#000000' },
  punctuation: { color: '#000000' },
  string: { color: '#a31515' },
  regexp: { color: '#811f3f' },
  escape: { color: '#ee0000' },
  number: { color: '#098658' },
  bool: { color: '#0000ff' },
  atom: { color: '#0000ff' },
  type: { color: '#267f99' },
  class: { color: '#267f99' },
  namespace: { color: '#267f99' },
  function: { color: '#795e26' },
  property: { color: '#001080' },
  variable: { color: '#001080' },
  constant: { color: '#0070c1' },
  builtin: { color: '#0070c1' },
  attribute: { color: '#001080' },
  tag: { color: '#800000' },
  meta: { color: '#0000ff' },
  invalid: { color: '#cd3131' },
  inserted: { color: '#098658' },
  deleted: { color: '#a31515' },
  link: { color: '#0451a5' },
  mathCommand: { color: '#0000ff' },
  mathBrace: { color: '#000000' },
  mathOp: { color: '#000000' },
  mathNumber: { color: '#098658' },
  mathComment: { color: '#008000', fontStyle: 'italic' }
}

export const DARK: Record<TokenKey, TokenColor> = {
  comment: { color: '#6a9955', fontStyle: 'italic' },
  keyword: { color: '#569cd6' },
  operator: { color: '#d4d4d4' },
  punctuation: { color: '#d4d4d4' },
  string: { color: '#ce9178' },
  regexp: { color: '#d16969' },
  escape: { color: '#d7ba7d' },
  number: { color: '#b5cea8' },
  bool: { color: '#569cd6' },
  atom: { color: '#569cd6' },
  type: { color: '#4ec9b0' },
  class: { color: '#4ec9b0' },
  namespace: { color: '#4ec9b0' },
  function: { color: '#dcdcaa' },
  property: { color: '#9cdcfe' },
  variable: { color: '#9cdcfe' },
  constant: { color: '#4fc1ff' },
  builtin: { color: '#4fc1ff' },
  attribute: { color: '#9cdcfe' },
  tag: { color: '#569cd6' },
  meta: { color: '#c586c0' },
  invalid: { color: '#f44747' },
  inserted: { color: '#b5cea8' },
  deleted: { color: '#ce9178' },
  link: { color: '#9cdcfe' },
  mathCommand: { color: '#569cd6' },
  mathBrace: { color: '#d4d4d4' },
  mathOp: { color: '#d4d4d4' },
  mathNumber: { color: '#b5cea8' },
  mathComment: { color: '#6a9955', fontStyle: 'italic' }
}

const PALETTES: Record<ColorTheme, Record<TokenKey, TokenColor>> = {
  light: LIGHT,
  dark: DARK
}

/** Widget/export interior (`.hljs` base) — VSCode editor background/text. */
const BASE: Record<ColorTheme, TokenColor> = {
  light: { color: '#333333' },
  dark: { color: '#d4d4d4' }
}

const BASE_BG: Record<ColorTheme, string> = {
  light: '#ffffff',
  dark: '#1e1e1e'
}

/**
 * hljs class vocabulary → semantic keys. Covers what `highlight.js/lib/common`
 * actually emits (compound scopes land as `hljs-title class_`-style class
 * pairs — see the compound selectors below).
 */
const HLJS_RULES: Array<[string, TokenKey]> = [
  ['.hljs-comment', 'comment'],
  ['.hljs-quote', 'comment'],
  ['.hljs-doctag', 'comment'],
  ['.hljs-keyword', 'keyword'],
  ['.hljs-meta', 'meta'],
  ['.hljs-selector-tag', 'tag'],
  ['.hljs-tag', 'tag'],
  ['.hljs-name', 'tag'],
  ['.hljs-template-tag', 'keyword'],
  ['.hljs-type', 'type'],
  ['.hljs-built_in', 'builtin'],
  ['.hljs-literal', 'bool'],
  ['.hljs-number', 'number'],
  ['.hljs-symbol', 'constant'],
  ['.hljs-bullet', 'constant'],
  ['.hljs-formula', 'number'],
  ['.hljs-char', 'string'],
  ['.hljs-string', 'string'],
  ['.hljs-regexp', 'regexp'],
  ['.hljs-title', 'function'],
  ['.hljs-title.function_', 'function'],
  ['.hljs-title.class_', 'class'],
  ['.hljs-title.class_.inherited__', 'class'],
  ['.hljs-params', 'variable'],
  ['.hljs-property', 'property'],
  ['.hljs-attr', 'attribute'],
  ['.hljs-attribute', 'attribute'],
  ['.hljs-variable', 'variable'],
  ['.hljs-template-variable', 'variable'],
  ['.hljs-subst', 'variable'],
  ['.hljs-section', 'keyword'],
  ['.hljs-link', 'link'],
  ['.hljs-addition', 'inserted'],
  ['.hljs-deletion', 'deleted'],
  ['.hljs-operator', 'operator'],
  ['.hljs-punctuation', 'punctuation'],
  ['.hljs-code', 'string']
]

/** Selector-grammar classes (CSS-in-markdown) — best-effort semantic map. */
const HLJS_SELECTOR_RULES: Array<[string, TokenKey]> = [
  ['.hljs-selector-id', 'function'],
  ['.hljs-selector-class', 'class'],
  ['.hljs-selector-attr', 'attribute'],
  ['.hljs-selector-pseudo', 'keyword']
]

function decl(c: TokenColor): string {
  return `color: ${c.color}${c.fontStyle ? `; font-style: ${c.fontStyle}` : ''}`
}

/**
 * Materialization (a): unscoped hljs-vocabulary CSS. The consumer scopes it
 * under the theme class via the bare-`.hljs` string replace (see module
 * header — compound `code.hljs` selectors would be mangled dead).
 */
export function hljsCss(theme: ColorTheme): string {
  const p = PALETTES[theme]
  const lines: string[] = [
    `.hljs { ${decl(BASE[theme])}; background: ${BASE_BG[theme]} }`
  ]
  // emphasis/strong are font-style/weight only (VSCode maps them to plain text)
  lines.push('.hljs-emphasis { font-style: italic }')
  lines.push('.hljs-strong { font-weight: bold }')
  const seen = new Set<string>()
  for (const [sel, key] of [...HLJS_RULES, ...HLJS_SELECTOR_RULES]) {
    if (sel === '.hljs-emphasis' || sel === '.hljs-strong') continue // font-only above
    if (seen.has(sel)) continue
    seen.add(sel)
    lines.push(`${sel} { ${decl(p[key])} }`)
  }
  return lines.join('\n')
}

/** Materialization (a′): focused math panel classes (step ④). */
export function texCss(theme: ColorTheme): string {
  const p = PALETTES[theme]
  return [
    `.cm-md-tex-command { color: ${p.mathCommand.color} }`,
    `.cm-md-tex-brace { color: ${p.mathBrace.color} }`,
    `.cm-md-tex-op { color: ${p.mathOp.color} }`,
    `.cm-md-tex-number { color: ${p.mathNumber.color} }`,
    `.cm-md-tex-comment { ${decl(p.mathComment)} }`,
    `.cm-md-tex-escape { color: ${p.escape.color} }`
  ].join('\n')
}

/**
 * Materialization (b): HighlightStyle specs for Lezer tokens. One entry per
 * tag group (tags array), values straight from the same palette.
 */
export function codeTagStyles(theme: ColorTheme): TagStyle[] {
  const p = PALETTES[theme]
  const s = (key: TokenKey, tag: TagStyle['tag']): TagStyle => {
    const c = p[key]
    return { tag, color: c.color, ...(c.fontStyle ? { fontStyle: c.fontStyle } : {}) }
  }
  return [
    s('keyword', [t.keyword, t.controlKeyword, t.modifier, t.moduleKeyword]),
    s('comment', [t.lineComment, t.blockComment, t.comment, t.docComment]),
    s('string', [t.string, t.special(t.string), t.character]),
    s('regexp', t.regexp),
    // t.escape deliberately unmapped: markdown tags \, latex spacing and
    // prose \* escapes alike (Escape: tags.escape) — red noise in math panels.
    s('number', [t.number, t.integer, t.float]),
    s('bool', [t.bool, t.null]),
    s('atom', t.atom),
    s('type', [t.typeName, t.namespace]),
    s('class', t.className),
    s('function', [t.function(t.variableName), t.function(t.propertyName)]),
    s('property', t.propertyName),
    s('variable', [t.variableName, t.definition(t.variableName)]),
    s('constant', [t.constant(t.variableName), t.standard(t.variableName)]),
    s('builtin', t.standard(t.name)),
    s('attribute', t.attributeName),
    s('tag', t.tagName),
    s('meta', t.meta),
    // markdown HeaderMark/CodeMark/QuoteMark are t.processingInstruction,
    // which inherits from t.meta (processingInstruction: t(meta)) — child tags
    // inherit parent styles, so "unmapping" isn't enough. Re-skin explicitly
    // to the base text color: prose marks stay uncolored (theme.ts owns prose).
    { tag: t.processingInstruction, color: BASE[theme].color },
    s('invalid', t.invalid),
    s('inserted', t.inserted),
    s('deleted', t.deleted),
    s('operator', [t.operator, t.separator]),
    s('punctuation', [t.punctuation, t.bracket, t.brace, t.paren, t.angleBracket])
  ]
}
