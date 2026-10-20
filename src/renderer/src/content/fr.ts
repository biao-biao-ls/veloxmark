import { WELCOME_LOGO_DATA_URI } from '../welcomeLogo'
import { OPEN_KEY, SAVE_KEY } from './keys'

export const WELCOME_MD_FR = `# Bienvenue dans VeloxMark

Un éditeur **Markdown** avec aperçu en direct — les marqueurs de \`syntaxe\` disparaissent dès que vous quittez la ligne, comme dans Typora.

## Fonctionnalités

- Édition avec aperçu en direct (style WYSIWYG)
- *Italique*, **gras**, ~~barré~~, \`code en ligne\`
- [Liens](https://commonmark.org) et images
- Listes de tâches :
  - [x] Ouvrir un fichier (${OPEN_KEY})
  - [ ] Essayer une formule mathématique
- Diagrammes Mermaid et code avec coloration syntaxique
- Encarts, notes de bas de page, ==surlignage==
- Édition multi-onglets, panneau Plan, export PDF/HTML

## Math

Les formules en ligne comme $E = mc^2$ fonctionnent, ainsi que les formules hors ligne :

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

## Code

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## Diagramme

\`\`\`mermaid
graph LR
  A[Écrire du Markdown] --> B{Aperçu en direct}
  B --> C[Rendu soigné]
  B --> D[Cliquez pour modifier la source]
\`\`\`

## Tableau

| Fonctionnalité | État | Remarques |
| :--- | :--: | ---: |
| Aperçu en direct | ✅ | Style Typora |
| Math | ✅ | KaTeX |
| Mermaid | ✅ | cliquez pour modifier |

## Image

![Logo VeloxMark](${WELCOME_LOGO_DATA_URI} =128x128)

## Syntaxe étendue

Encarts et ==texte surligné== :

> [!TIP]
> Cliquez sur un diagramme, une formule ou un bloc de code pour en modifier la source.

Les notes de bas de page[^1] renvoient à leur définition — cliquez sur le numéro pour l’essayer.

[^1]: Comme celle-ci.

> Astuce : cliquez sur n’importe quel bloc rendu (code, formule, diagramme, tableau, image) pour le modifier.
> Appuyez sur \`${OPEN_KEY}\` pour ouvrir un fichier \`.md\`, \`${SAVE_KEY}\` pour enregistrer.
`

export const HELP_MD_FR = `# Référence de syntaxe Markdown

## Titres

Préfixez par # (1 à 6 dièses) :

\`\`\`markdown
# H1
## H2
### H3
\`\`\`

## Emphase

\`\`\`markdown
**gras**  *italique*  ~~barré~~  \`code\`
\`\`\`

## Listes

\`\`\`markdown
- élément non ordonné
1. élément ordonné
- [ ] tâche
- [x] terminé
\`\`\`

## Citation et séparateur

\`\`\`markdown
> texte cité

---
\`\`\`

## Math (KaTeX)

\`\`\`markdown
en ligne : $a^2 + b^2 = c^2$

hors ligne :
$$
\\frac{1}{2}
$$
\`\`\`

## Diagrammes (Mermaid)

\`\`\`\`markdown
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`\`

## Liens et images

\`\`\`markdown
[texte](https://example.com)
![texte de remplacement](./image.png)
\`\`\`
`
