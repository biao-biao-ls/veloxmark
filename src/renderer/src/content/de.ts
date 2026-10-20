import { WELCOME_LOGO_DATA_URI } from '../welcomeLogo'
import { OPEN_KEY, SAVE_KEY } from './keys'

export const WELCOME_MD_DE = `# Willkommen bei VeloxMark

Ein **Markdown**-Editor mit Live-Vorschau — \`Syntax\`-Marker verschwinden, sobald Sie die Zeile verlassen, genau wie in Typora.

## Funktionen

- Bearbeiten mit Live-Vorschau (WYSIWYG-Stil)
- *Kursiv*, **fett**, ~~durchgestrichen~~, \`Inline-Code\`
- [Links](https://commonmark.org) und Bilder
- Aufgabenlisten:
  - [x] Eine Datei öffnen (${OPEN_KEY})
  - [ ] Eine Formel ausprobieren
- Mermaid-Diagramme und Code-Hervorhebung
- Hinweisfelder, Fußnoten, ==Hervorhebungen==
- Bearbeiten mit mehreren Tabs, Gliederungsleiste, Export nach PDF/HTML

## Mathematik

Inline-Mathematik wie $E = mc^2$ und Blockmathematik:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

## Code

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## Diagramm

\`\`\`mermaid
graph LR
  A[Markdown schreiben] --> B{Live-Vorschau}
  B --> C[Sieht gut aus]
  B --> D[Zum Bearbeiten klicken]
\`\`\`

## Tabelle

| Funktion | Status | Anmerkungen |
| :--- | :--: | ---: |
| Live-Vorschau | ✅ | Typora-Stil |
| Mathematik | ✅ | KaTeX |
| Mermaid | ✅ | Klicken zum Bearbeiten |

## Bild

![VeloxMark-Logo](${WELCOME_LOGO_DATA_URI} =128x128)

## Erweiterte Syntax

Hinweisfelder und ==hervorgehobener Text==:

> [!TIP]
> Klicken Sie auf ein Diagramm, eine Formel oder einen Codeblock, um dessen Quelltext zu bearbeiten.

Fußnoten[^1] springen zu ihrer Definition — klicken Sie auf die Nummer, um es auszuprobieren.

[^1]: Wie diese hier.

> Tipp: Klicken Sie auf einen beliebigen gerenderten Block (Code, Formel, Diagramm, Tabelle, Bild), um ihn zu bearbeiten.
> Drücken Sie \`${OPEN_KEY}\`, um eine \`.md\`-Datei zu öffnen, und \`${SAVE_KEY}\`, um zu sichern.
`

export const HELP_MD_DE = `# Markdown-Syntaxreferenz

## Überschriften

Mit # beginnen (1–6 Rauten):

\`\`\`markdown
# H1
## H2
### H3
\`\`\`

## Betonung

\`\`\`markdown
**fett**  *kursiv*  ~~durchgestrichen~~  \`Code\`
\`\`\`

## Listen

\`\`\`markdown
- Ungeordnetes Element
1. Geordnetes Element
- [ ] Aufgabe
- [x] Erledigt
\`\`\`

## Zitat & Trennlinie

\`\`\`markdown
> Zitierter Text

---
\`\`\`

## Mathematik (KaTeX)

\`\`\`markdown
Inline: $a^2 + b^2 = c^2$

Anzeige:
$$
\\frac{1}{2}
$$
\`\`\`

## Diagramme (Mermaid)

\`\`\`\`markdown
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`\`

## Links & Bilder

\`\`\`markdown
[Text](https://example.com)
![Alternativtext](./image.png)
\`\`\`
`
