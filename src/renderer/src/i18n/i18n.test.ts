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
