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

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = DICTS[currentLang] ?? EN
  let s = dict[key] ?? EN[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v))
  }
  return s
}

export function useTranslation(): { t: typeof t; lang: Lang } {
  useSyncExternalStore(subscribe, getLang, () => 'en' as Lang)
  return { t, lang: currentLang }
}
