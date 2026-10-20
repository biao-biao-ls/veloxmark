import { WELCOME_LOGO_DATA_URI } from '../welcomeLogo'
import { OPEN_KEY, SAVE_KEY } from './keys'

export const WELCOME_MD_PT = `# Bem-vindo ao VeloxMark

Um editor de **Markdown** com visualização ao vivo — os marcadores de \`sintaxe\` desaparecem quando você sai da linha, igual ao Typora.

## Recursos

- Edição com visualização ao vivo (estilo WYSIWYG)
- *Itálico*, **negrito**, ~~tachado~~, \`código em linha\`
- [Links](https://commonmark.org) e imagens
- Lista de tarefas:
  - [x] Abrir um arquivo (${OPEN_KEY})
  - [ ] Experimentar uma fórmula matemática
- Diagramas Mermaid e código destacado
- Notas destacadas, notas de rodapé, ==destaques==
- Edição em várias abas, painel de sumário, exportação para PDF/HTML

## Matemática

Fórmulas em linha como $E = mc^2$ funcionam, e fórmulas em bloco:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

## Código

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## Diagrama

\`\`\`mermaid
graph LR
  A[Escrever Markdown] --> B{Visualização ao vivo}
  B --> C[Fica bonito]
  B --> D[Clique para editar a fonte]
\`\`\`

## Tabela

| Recurso | Status | Observações |
| :------ | :----: | ----: |
| Visualização ao vivo | ✅ | Estilo Typora |
| Matemática | ✅ | KaTeX |
| Mermaid | ✅ | clique para editar |

## Imagem

![Logotipo do VeloxMark](${WELCOME_LOGO_DATA_URI} =128x128)

## Sintaxe estendida

Notas destacadas e ==texto em destaque==:

> [!TIP]
> Clique em um diagrama, fórmula ou bloco de código para editar o código-fonte.

Notas de rodapé[^1] saltam para a definição — clique no número para experimentar.

[^1]: Como esta aqui.

> Dica: clique em qualquer bloco renderizado (código, fórmula, diagrama, tabela, imagem) para editá-lo.
> Pressione \`${OPEN_KEY}\` para abrir um arquivo \`.md\`, \`${SAVE_KEY}\` para salvar.
`

export const HELP_MD_PT = `# Referência de sintaxe Markdown

## Títulos

Prefixe com # (1–6 cerquilhas):

\`\`\`markdown
# H1
## H2
### H3
\`\`\`

## Ênfase

\`\`\`markdown
**negrito**  *itálico*  ~~tachado~~  \`código\`
\`\`\`

## Listas

\`\`\`markdown
- item não ordenado
1. item ordenado
- [ ] tarefa
- [x] concluída
\`\`\`

## Citação e divisor

\`\`\`markdown
> texto citado

---
\`\`\`

## Matemática (KaTeX)

\`\`\`markdown
em linha: $a^2 + b^2 = c^2$

em bloco:
$$
\\frac{1}{2}
$$
\`\`\`

## Diagramas (Mermaid)

\`\`\`\`markdown
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
\`\`\`\`

## Links e imagens

\`\`\`markdown
[texto](https://example.com)
![texto alternativo](./image.png)
\`\`\`
`
