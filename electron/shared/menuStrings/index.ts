import type { UiLang } from '../lang'
import type { MenuStrings } from './en'
import { MENU_EN } from './en'
import { MENU_ZH } from './zh'
import { MENU_JA } from './ja'
import { MENU_KO } from './ko'
import { MENU_ES } from './es'
import { MENU_PT } from './pt'
import { MENU_FR } from './fr'
import { MENU_DE } from './de'
import { MENU_RU } from './ru'

export type { MenuStrings } from './en'

// Every UI language provides a full pack in ./<lang>.ts (key parity enforced by MenuStrings).
export const NATIVE_MENU_STRINGS: Record<UiLang, MenuStrings> = {
  en: MENU_EN,
  zh: MENU_ZH,
  ja: MENU_JA,
  ko: MENU_KO,
  es: MENU_ES,
  pt: MENU_PT,
  fr: MENU_FR,
  de: MENU_DE,
  ru: MENU_RU
}
