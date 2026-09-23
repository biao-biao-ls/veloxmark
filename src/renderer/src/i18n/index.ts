/**
 * P14 i18n core — dictionary lookup + React subscription (no heavy deps).
 *
 * `t(key, params)` replaces `{name}` placeholders. Components call `t` during
 * render and subscribe via `useTranslation()` so a language switch re-renders
 * the tree; non-React callers (command registry, imperative dialogs) read the
 * active language at call time through `t` / `getLang`.
 */
import { useSyncExternalStore } from 'react'
import { getPreferences, type LanguagePref } from '../preferences/store'
import { EN } from './en'
import { ZH } from './zh'

export type Lang = 'zh' | 'en'
export type { LanguagePref }
export type Dict = Record<string, string>

const DICTS: Record<Lang, Dict> = { en: EN, zh: ZH }

export function resolveLang(pref: LanguagePref): Lang {
  if (pref === 'zh' || pref === 'en') return pref
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

// 3.19: boot language resolves from the preferences store (single read source;
// the store sanitizes `veloxmark.preferences` — missing/garbage → 'system',
// same fallback as the former inline localStorage parse).
let currentLang: Lang = resolveLang(getPreferences().language)
const listeners = new Set<() => void>()

export function getLang(): Lang {
  return currentLang
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setLang(lang: Lang): void {
  if (lang === currentLang) return
  currentLang = lang
  listeners.forEach((l) => l())
}

/** Translate `key` in the active language; unknown keys fall back to en → key. */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = DICTS[currentLang] ?? EN
  let s = dict[key] ?? EN[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v))
  }
  return s
}

/** Subscribe a component to language changes; render with the returned `t`. */
export function useTranslation(): { t: typeof t; lang: Lang } {
  useSyncExternalStore(subscribe, getLang, () => 'en' as Lang)
  return { t, lang: currentLang }
}
