/**
 * i18n key-alignment guard (task 0.2, docs/specs/0.2-i18n-alignment-test).
 *
 * en.ts is the source of truth for keys; zh.ts must mirror it exactly. The
 * contract was previously comment-only ("Keys must mirror en.ts exactly") —
 * these assertions lock the baseline and catch drift at test time:
 *
 *   1. EN/ZH key sets are equal (diff reported by key name)
 *   2. no duplicate key literals within either dictionary source
 *      (object-literal dupes are silent last-wins at runtime)
 *   3. {placeholder} sets agree per key across languages
 *   4. static t('…') references resolve against EN (template-literal /
 *      computed keys are out of the static scan surface by design)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { NATIVE_MENU_STRINGS } from '../../../../electron/shared/menuStrings'
import { CALLOUT_TYPES } from '../editor/livePreview/callout'
import { EN } from './en'
import { ZH } from './zh'

function dictSource(name: 'en' | 'zh'): string {
  return readFileSync(fileURLToPath(new URL(`./${name}.ts`, import.meta.url)), 'utf8')
}

/** Key literals from top-level `'key':` entries, in source order. */
function keyLiterals(source: string): string[] {
  return [...source.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1])
}

function placeholders(value: string): string {
  return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
}

/** Recursively collect .ts/.tsx sources under dir, skipping tests and stubs. */
function collectSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'test-stubs') continue
      collectSources(p, out)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(p)
    }
  }
  return out
}

describe('i18n dictionaries', () => {
  it('EN and ZH define the same key set', () => {
    const enKeys = Object.keys(EN)
    const zhKeys = Object.keys(ZH)
    const missingInZh = enKeys.filter((k) => !(k in ZH))
    const missingInEn = zhKeys.filter((k) => !(k in EN))
    expect(missingInZh, `missing in zh.ts: ${missingInZh.join(', ')}`).toEqual([])
    expect(missingInEn, `missing in en.ts: ${missingInEn.join(', ')}`).toEqual([])
  })

  it('no duplicate key literals within either source', () => {
    for (const name of ['en', 'zh'] as const) {
      const keys = keyLiterals(dictSource(name))
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
      expect(dupes, `duplicate keys in ${name}.ts: ${[...new Set(dupes)].join(', ')}`).toEqual([])
    }
  })

  it('placeholders agree per key across languages', () => {
    const mismatches: string[] = []
    for (const [key, enValue] of Object.entries(EN)) {
      const zhValue = ZH[key]
      if (zhValue === undefined) continue // covered by the key-set test
      if (placeholders(enValue) !== placeholders(zhValue)) {
        mismatches.push(`${key} (en: {${placeholders(enValue)}} vs zh: {${placeholders(zhValue)}})`)
      }
    }
    expect(mismatches, `placeholder drift: ${mismatches.join('; ')}`).toEqual([])
  })
})

describe('i18n static references', () => {
  it("every static t('…') key resolves against EN", () => {
    const srcRoot = fileURLToPath(new URL('..', import.meta.url)) // src/renderer/src
    const unresolved: string[] = []
    for (const file of collectSources(srcRoot)) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/\bt\(\s*(['"])([^'"]+)\1\s*[,)]/g)) {
        const key = m[2]
        if (!(key in EN)) unresolved.push(`${key} (${file})`)
      }
    }
    expect(unresolved, `unresolved t() keys: ${unresolved.join('; ')}`).toEqual([])
  })
})

// ---- 3.18: dynamic-key registration -------------------------------------------
// CLAUDE.md requires template-composed t() key families to be registered with a
// guard. `calloutDefaultTitle` uses `t('callout.'+type)`; instead of a prefix
// whitelist we assert the full family (CALLOUT_TYPES × callout.*) resolves.

describe('callout.* dynamic key family (3.18)', () => {
  it('callout.<type> resolves in EN and ZH for every CalloutType', () => {
    const missing: string[] = []
    for (const ty of CALLOUT_TYPES) {
      const key = `callout.${ty}`
      if (!(key in EN)) missing.push(`${key} (en)`)
      if (!(key in ZH)) missing.push(`${key} (zh)`)
    }
    expect(missing, `unresolved callout.* keys: ${missing.join('; ')}`).toEqual([])
  })
})

// ---- 3.17: third dictionary (darwin native menu strings) ----------------------
// Same guards as EN/ZH above, applied to electron/shared/menuStrings.ts. The
// source scan accepts unquoted `key:` entries (this dict's layout) and scans
// each language map separately so cross-language repeats are not "dupes".

describe('native menu strings (third dictionary, 3.17)', () => {
  const menuSource = readFileSync(
    fileURLToPath(new URL('../../../../electron/shared/menuStrings.ts', import.meta.url)),
    'utf8'
  )
  const enSrc = menuSource.slice(menuSource.indexOf('  en: {'), menuSource.indexOf('  zh: {'))
  const zhSrc = menuSource.slice(menuSource.indexOf('  zh: {'))

  function menuKeyLiterals(source: string): string[] {
    return [...source.matchAll(/^\s*'?([\w]+)'?:/gm)]
      .map((m) => m[1])
      .filter((k) => k !== 'en' && k !== 'zh')
  }

  it('zh and en define the same key set', () => {
    const enKeys = Object.keys(NATIVE_MENU_STRINGS.en)
    const zhKeys = Object.keys(NATIVE_MENU_STRINGS.zh)
    const missingInZh = enKeys.filter((k) => !(k in NATIVE_MENU_STRINGS.zh))
    const missingInEn = zhKeys.filter((k) => !(k in NATIVE_MENU_STRINGS.en))
    expect(missingInZh, `missing in menuStrings zh: ${missingInZh.join(', ')}`).toEqual([])
    expect(missingInEn, `missing in menuStrings en: ${missingInEn.join(', ')}`).toEqual([])
  })

  it('no duplicate key literals within either language map', () => {
    for (const [lang, src] of [
      ['en', enSrc],
      ['zh', zhSrc]
    ] as const) {
      const keys = menuKeyLiterals(src)
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
      expect(dupes, `duplicate keys in menuStrings ${lang}: ${[...new Set(dupes)].join(', ')}`).toEqual([])
    }
  })

  it('placeholders agree per key across languages', () => {
    const mismatches: string[] = []
    for (const [key, enValue] of Object.entries(NATIVE_MENU_STRINGS.en)) {
      const zhValue = NATIVE_MENU_STRINGS.zh[key]
      if (zhValue === undefined) continue // covered by the key-set test
      if (placeholders(enValue) !== placeholders(zhValue)) {
        mismatches.push(`${key} (en: {${placeholders(enValue)}} vs zh: {${placeholders(zhValue)}})`)
      }
    }
    expect(mismatches, `placeholder drift: ${mismatches.join('; ')}`).toEqual([])
  })
})

// ---- IT-03 FE-01: render.* namespace (REN-render-zone copy contract) ---------
// Undo-receipt toasts compose the「（Ctrl+Z 可撤销）」suffix from a single
// per-language constant (en: " (Ctrl+Z to undo)" — leading space is the
// separator, matching the IT-01 frozen en family "Row inserted above
// (Ctrl+Z to undo)"). The four receipt sentences are frozen as full literals
// below (frozenCopy.test.ts pattern) so a suffix-constant drift — like the
// missing separator space this guard previously let through — cannot hide
// behind a loose endsWith check. PEND-15: task-item checkbox toggles and fold
// switches are lightweight ops with NO toast — the toast key set is locked to
// exactly the four receipt keys below.

describe('render.* key family (IT-03 FE-01)', () => {
  const RENDER_TOAST_KEYS = [
    'render.toast.imageSize',
    'render.toast.imageAlign',
    'render.toast.linkUpdated',
    'render.toast.listMoved'
  ] as const
  const RENDER_STATIC_KEYS = [
    ...RENDER_TOAST_KEYS,
    'render.image.alignLeft',
    'render.image.alignCenter',
    'render.image.alignRight',
    'render.image.width',
    'render.image.done',
    'render.image.alignLeftTitle',
    'render.image.alignCenterTitle',
    'render.image.alignRightTitle',
    'render.image.widthTitle',
    'render.image.doneTitle',
    'render.image.resizeTitle',
    'render.image.broken',
    'render.image.retry',
    'render.image.retryTitle',
    'render.image.editUrl',
    'render.image.editUrlTitle',
    'render.image.urlPlaceholder',
    'render.link.editUrl',
    'render.link.open',
    'render.link.copy',
    'render.link.editUrlTitle',
    'render.link.openTitle',
    'render.link.copyTitle',
    'render.link.urlPlaceholder',
    'render.link.confirm',
    'render.link.cancel',
    'render.fold.collapse',
    'render.fold.expand',
    'render.fold.restore',
    'render.fold.lines',
    // FE-06 (shared with FE-03's audit — registered once, don't double-log)
    'render.list.dragHandle'
  ] as const
  const ZH_UNDO_SUFFIX = '（Ctrl+Z 可撤销）'
  // Leading space is the en sentence separator (composed by UNDO_SUFFIX in
  // en.ts) — keep this constant in lockstep with that value.
  const EN_UNDO_SUFFIX = ' (Ctrl+Z to undo)'

  // Frozen full sentences (frozenCopy.test.ts pattern): independent literals,
  // not derived from the *UNDO_SUFFIX constants, so the composed values cannot
  // drift (missing separator space, hardcoded suffix, …) without failing here.
  const FROZEN_TOAST_EN: Record<string, string> = {
    'render.toast.imageSize': 'Image size adjusted (Ctrl+Z to undo)',
    'render.toast.imageAlign': 'Image alignment set (Ctrl+Z to undo)',
    'render.toast.linkUpdated': 'Link URL updated (Ctrl+Z to undo)',
    'render.toast.listMoved': 'List item moved (Ctrl+Z to undo)'
  }
  const FROZEN_TOAST_ZH: Record<string, string> = {
    'render.toast.imageSize': '已调整图片尺寸（Ctrl+Z 可撤销）',
    'render.toast.imageAlign': '已设置图片对齐（Ctrl+Z 可撤销）',
    'render.toast.linkUpdated': '已更新链接地址（Ctrl+Z 可撤销）',
    'render.toast.listMoved': '已移动列表项（Ctrl+Z 可撤销）'
  }

  it('render.* key set is symmetric between EN and ZH', () => {
    const enRender = Object.keys(EN).filter((k) => k.startsWith('render.'))
    const zhRender = Object.keys(ZH).filter((k) => k.startsWith('render.'))
    const missingInZh = enRender.filter((k) => !(k in ZH))
    const missingInEn = zhRender.filter((k) => !(k in EN))
    expect(missingInZh, `missing in zh.ts: ${missingInZh.join(', ')}`).toEqual([])
    expect(missingInEn, `missing in en.ts: ${missingInEn.join(', ')}`).toEqual([])
  })

  it('every registered render.* key is non-empty in both languages', () => {
    const empty: string[] = []
    for (const key of RENDER_STATIC_KEYS) {
      if (!(EN[key] ?? '').trim()) empty.push(`${key} (en)`)
      if (!(ZH[key] ?? '').trim()) empty.push(`${key} (zh)`)
    }
    expect(empty, `empty render.* values: ${empty.join(', ')}`).toEqual([])
  })

  it('render.toast.* is exactly the four receipt keys (PEND-15: no task-check / fold toasts)', () => {
    const enToast = Object.keys(EN)
      .filter((k) => k.startsWith('render.toast.'))
      .sort()
    expect(enToast).toEqual([...RENDER_TOAST_KEYS].sort())
  })

  it('receipt toasts are frozen full sentences in both languages (composed suffix included)', () => {
    for (const key of RENDER_TOAST_KEYS) {
      expect(EN[key], `${key} en frozen full value`).toBe(FROZEN_TOAST_EN[key])
      expect(ZH[key], `${key} zh frozen full value`).toBe(FROZEN_TOAST_ZH[key])
    }
  })

  it('frozen receipt sentences end with the shared undo suffix constants', () => {
    for (const key of RENDER_TOAST_KEYS) {
      expect(FROZEN_TOAST_EN[key].endsWith(EN_UNDO_SUFFIX), `${key} en ends with「${EN_UNDO_SUFFIX}」`).toBe(true)
      expect(FROZEN_TOAST_ZH[key].endsWith(ZH_UNDO_SUFFIX), `${key} zh ends with「${ZH_UNDO_SUFFIX}」`).toBe(true)
    }
  })

  it('render.fold.lines keeps the {n} line-count placeholder in both languages', () => {
    expect(placeholders(EN['render.fold.lines'])).toBe('n')
    expect(placeholders(ZH['render.fold.lines'])).toBe('n')
  })
})
