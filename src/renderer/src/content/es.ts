import { WELCOME_LOGO_DATA_URI } from '../welcomeLogo'
import { OPEN_KEY, SAVE_KEY } from './keys'

export const WELCOME_MD_ES = `# Bienvenido a VeloxMark

Un editor de **Markdown** con vista previa en vivo — los marcadores de \`sintaxis\` desaparecen al salir de la línea, igual que en Typora.

## Funciones

- Edición con vista previa en vivo (estilo WYSIWYG)
- *Cursiva*, **negrita**, ~~tachado~~, \`código en línea\`
- [Enlaces](https://commonmark.org) e imágenes
- Listas de tareas:
  - [x] Abrir un archivo (${OPEN_KEY})
  - [ ] Probar una fórmula matemática
- Diagramas Mermaid y código resaltado
- Avisos, notas al pie, ==resaltados==
- Edición con varias pestañas, panel de esquema y exportación a PDF/HTML

## Matemáticas

Las fórmulas en línea como $E = mc^2$ funcionan, y también las de bloque:

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
  A[Escribir Markdown] --> B{Vista previa en vivo}
  B --> C[Resultado elegante]
  B --> D[Clic para editar el código]
\`\`\`

## Tabla

| Función | Estado | Notas |
| :------ | :----: | ----: |
| Vista previa en vivo | ✅ | Estilo Typora |
| Matemáticas | ✅ | KaTeX |
| Mermaid | ✅ | clic para editar |

## Imagen

![Logotipo de VeloxMark](${WELCOME_LOGO_DATA_URI} =128x128)

## Sintaxis extendida

Avisos y ==texto resaltado==:

> [!TIP]
> Haz clic en un diagrama, una fórmula o un bloque de código para editar su código fuente.

Las notas al pie[^1] saltan a su definición — haz clic en el número para probar.

[^1]: Como esta.

> Consejo: haz clic en cualquier bloque renderizado (código, fórmula, diagrama, tabla, imagen) para editarlo.
> Pulsa \`${OPEN_KEY}\` para abrir un archivo \`.md\`, \`${SAVE_KEY}\` para guardar.
`

export const HELP_MD_ES = `# Referencia de sintaxis Markdown

## Títulos

Con el prefijo # (de 1 a 6 almohadillas):

\`\`\`markdown
# H1
## H2
### H3
\`\`\`

## Énfasis

\`\`\`markdown
**negrita**  *cursiva*  ~~tachado~~  \`código\`
\`\`\`

## Listas

\`\`\`markdown
- elemento sin orden
1. elemento numerado
- [ ] tarea
- [x] completada
\`\`\`

## Cita y separador

\`\`\`markdown
> texto citado

---
\`\`\`

## Matemáticas (KaTeX)

\`\`\`markdown
en línea: $a^2 + b^2 = c^2$

en bloque:
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

## Enlaces e imágenes

\`\`\`markdown
[texto](https://example.com)
![texto alternativo](./image.png)
\`\`\`
`
