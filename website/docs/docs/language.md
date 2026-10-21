# Language & localization

VeloxMark's UI ships in nine languages:

| Language | Code |
| --- | --- |
| English | `en` |
| Chinese | `zh` |
| Japanese | `ja` |
| Korean | `ko` |
| Spanish | `es` |
| Portuguese | `pt` |
| French | `fr` |
| German | `de` |
| Russian | `ru` |

(In the app's language picker each language is listed under its own native name.)

The localization covers the whole UI: menus (native on macOS), dialogs, the status bar —
and even the welcome / help sample documents and the Mermaid template bodies, which are
picked per locale.

## Choosing a language

- **Follow the system** by default — the app picks the UI language from your OS locale
  when a pack exists for it, falling back to English.
- **Set it explicitly** from the preferences / View menu; the choice is remembered across
  sessions.

## Translating

Translations live in one pack file per language (UI dictionary, native menu strings,
welcome/help documents and Mermaid templates). Dictionary key parity is enforced by the
type system — a new language must ship all four packs to pass `npm run typecheck`.
Contributions welcome on [GitHub](https://github.com/biao-biao-ls/veloxmark).
