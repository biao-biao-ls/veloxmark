import { getLang, type Lang } from '../i18n'
import { HELP_MD_EN, WELCOME_MD_EN } from './en'
import { HELP_MD_ZH, WELCOME_MD_ZH } from './zh'
import { HELP_MD_JA, WELCOME_MD_JA } from './ja'
import { HELP_MD_KO, WELCOME_MD_KO } from './ko'
import { HELP_MD_ES, WELCOME_MD_ES } from './es'
import { HELP_MD_PT, WELCOME_MD_PT } from './pt'
import { HELP_MD_FR, WELCOME_MD_FR } from './fr'
import { HELP_MD_DE, WELCOME_MD_DE } from './de'
import { HELP_MD_RU, WELCOME_MD_RU } from './ru'

// Every UI language provides a full welcome/help pair in ./<lang>.ts.
const WELCOME_DOCS: Record<Lang, string> = {
  en: WELCOME_MD_EN,
  zh: WELCOME_MD_ZH,
  ja: WELCOME_MD_JA,
  ko: WELCOME_MD_KO,
  es: WELCOME_MD_ES,
  pt: WELCOME_MD_PT,
  fr: WELCOME_MD_FR,
  de: WELCOME_MD_DE,
  ru: WELCOME_MD_RU
}

const HELP_DOCS: Record<Lang, string> = {
  en: HELP_MD_EN,
  zh: HELP_MD_ZH,
  ja: HELP_MD_JA,
  ko: HELP_MD_KO,
  es: HELP_MD_ES,
  pt: HELP_MD_PT,
  fr: HELP_MD_FR,
  de: HELP_MD_DE,
  ru: HELP_MD_RU
}

export function getWelcomeMd(lang: string = getLang()): string {
  return WELCOME_DOCS[lang as Lang] ?? WELCOME_MD_EN
}

export function getHelpMd(lang: string = getLang()): string {
  return HELP_DOCS[lang as Lang] ?? HELP_MD_EN
}

/** True when the document is any localized welcome tab (used to re-localize it on language switch). */
export function isWelcomeMd(doc: string): boolean {
  return Object.values(WELCOME_DOCS).some((welcome) => welcome === doc)
}

export const WELCOME_MD = WELCOME_MD_EN
export const HELP_MD = HELP_MD_EN
