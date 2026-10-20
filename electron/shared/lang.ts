// Shared UI-language contract for both main and renderer processes.
// Locale packs live in: src/renderer/src/i18n/<lang>.ts (UI dictionaries),
// electron/shared/menuStrings/<lang>.ts, src/renderer/src/content/<lang>.ts,
// src/renderer/src/editor/mermaidTemplates/<lang>.ts.

export const UI_LANGS = ['en', 'zh', 'ja', 'ko', 'es', 'pt', 'fr', 'de', 'ru'] as const

export type UiLang = (typeof UI_LANGS)[number]

export function isUiLang(value: unknown): value is UiLang {
  return typeof value === 'string' && (UI_LANGS as readonly string[]).includes(value)
}

/** Map a BCP 47 locale tag (e.g. "zh-Hans", "pt-BR") to a supported UI language. */
export function localeToUiLang(locale: string): UiLang {
  const code = locale.toLowerCase().replace(/_/g, '-').slice(0, 2)
  return isUiLang(code) ? code : 'en'
}
