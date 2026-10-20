import { useSyncExternalStore } from 'react'
import { localeToUiLang, type UiLang } from '../../../../electron/shared/lang'
import { getPreferences, type LanguagePref } from '../preferences/store'
import { DE } from './de'
import { EN, type Dict } from './en'
import { ES } from './es'
import { FR } from './fr'
import { JA } from './ja'
import { KO } from './ko'
import { PT } from './pt'
import { RU } from './ru'
import { ZH } from './zh'

export type Lang = UiLang
export type { LanguagePref }
export type { Dict }

const DICTS: Record<Lang, Dict> = { en: EN, zh: ZH, ja: JA, ko: KO, es: ES, pt: PT, fr: FR, de: DE, ru: RU }

export function resolveLang(pref: LanguagePref): Lang {
  if (pref !== 'system') return pref
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return localeToUiLang(nav)
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
  const dict: Record<string, string> = DICTS[currentLang] ?? EN
  let s = dict[key] ?? (EN as Record<string, string>)[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v))
  }
  return s
}

export function useTranslation(): { t: typeof t; lang: Lang } {
  useSyncExternalStore(subscribe, getLang, () => 'en' as Lang)
  return { t, lang: currentLang }
}
