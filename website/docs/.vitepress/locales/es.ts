/**
 * Website UI strings — Spanish.
 * One pack per language; translations live only in these packs and in
 * website/docs/<lang>/ (see CLAUDE.md language policy).
 */

import type { WebsiteLocaleStrings } from './en'

export const ES: WebsiteLocaleStrings = {
  label: 'Español',
  lang: 'es-ES',
  hreflang: 'es',
  link: '/es/',
  ogLocale: 'es_ES',
  titleTemplate: 'Un editor de Markdown con vista previa en vivo',
  description:
    'Un editor de Markdown gratuito y de código abierto con vista previa en vivo para macOS, Windows y Linux. Matemáticas KaTeX, diagramas Mermaid y tablas nativas — todo renderizado en vivo.',
  homeOgTitle: 'VeloxMark — un editor de Markdown con vista previa en vivo',
  keywords:
    'editor de markdown, vista previa en vivo, código abierto, WYSIWYG, KaTeX, Mermaid, alternativa a Typora, Electron, CodeMirror',
  nav: [
    { text: 'Documentación', link: '/es/docs/' },
    { text: 'Descargar', link: '/es/download' }
  ],
  sidebar: [
    {
      text: 'Primeros pasos',
      items: [
        { text: 'Introducción', link: '/es/docs/' },
        { text: 'Instalación', link: '/es/docs/installation' },
        { text: 'Conceptos básicos', link: '/es/docs/basics' }
      ]
    },
    {
      text: 'Escritura',
      items: [
        { text: 'Edición en profundidad', link: '/es/docs/editing' },
        { text: 'Sintaxis de Markdown', link: '/es/docs/markdown-syntax' },
        { text: 'Imágenes', link: '/es/docs/images' }
      ]
    },
    {
      text: 'Referencia',
      items: [
        { text: 'Preferencias', link: '/es/docs/preferences' },
        { text: 'Atajos de teclado', link: '/es/docs/key-bindings' },
        { text: 'Idioma y localización', link: '/es/docs/language' },
        { text: 'Exportar un documento', link: '/es/docs/export' },
        { text: 'Temas', link: '/es/docs/themes' }
      ]
    },
    {
      text: 'Ayuda',
      items: [
        { text: 'Actualización automática', link: '/es/docs/updates' },
        { text: 'Preguntas frecuentes', link: '/es/docs/faq' }
      ]
    }
  ],
  editLinkText: 'Editar esta página en GitHub',
  footerMessage: 'Publicado bajo la licencia MIT.',
  outlineLabel: 'En esta página',
  docPrev: 'Anterior',
  docNext: 'Siguiente',
  breadcrumbHome: 'Inicio',
  breadcrumbDocs: 'Documentación',
  trustTicks: ['macOS · Windows · Linux', 'Local primero, sin cuenta', 'Licencia MIT, para siempre'],
  schemaDescription:
    'Un editor de Markdown gratuito y de código abierto con vista previa en vivo para macOS, Windows y Linux. El código fuente Markdown es la única fuente de datos: al guardar se escribe un .md plano con pérdida cero de ida y vuelta. Matemáticas KaTeX, diagramas Mermaid, edición nativa de tablas, notas destacadas, notas al pie y texto resaltado, todo renderizado en vivo.',
  schemaFeatures: [
    'Edición con vista previa en vivo (estilo Typora, en el lugar)',
    'Matemáticas KaTeX y diagramas Mermaid renderizados en vivo',
    'Edición nativa de tablas con editores de celda anidados',
    'Modo de enfoque, modo de máquina de escribir, temas claro y oscuro',
    'Exportación a PDF y HTML',
    'Archivos Markdown planos con pérdida cero de ida y vuelta',
    'Nueve idiomas de interfaz'
  ],
  llmsTxt:
    '# VeloxMark\n\n' +
    '> VeloxMark es un editor de Markdown gratuito y de código abierto (MIT) con vista previa en vivo para macOS, Windows y Linux. El código fuente Markdown es la única fuente de datos: el editor renderiza títulos, fórmulas, diagramas y tablas en su lugar, mientras que el archivo en disco sigue siendo Markdown plano con pérdida cero de ida y vuelta.\n\n' +
    'VeloxMark está construido sobre Electron y CodeMirror 6. Su motor de vista previa en vivo oculta los marcadores de sintaxis cuando el cursor deja una línea (estilo Typora), y cualquier bloque renderizado — código, fórmula KaTeX, diagrama Mermaid, tabla, imagen — puede hacerse clic para editar su código fuente Markdown. Incorpora edición nativa de tablas, modo de enfoque y modo de máquina de escribir, temas claro/oscuro, exportación a PDF/HTML, nueve idiomas de interfaz y actualización automática en Windows (NSIS) y Linux (AppImage).\n\n' +
    'Datos clave: licencia MIT · sin cuenta, sin telemetría · local primero · instalaciones para macOS (dmg/zip), Windows (instalador NSIS, zip portable), Linux (AppImage, deb, rpm, tar.gz, snap) · GitHub Releases con sumas de verificación SHA256SUMS.txt.\n\n' +
    '## Documentación\n\n' +
    '- [Introducción](https://veloxmark.knzn.net/es/docs/): Qué es VeloxMark, cómo funciona la vista previa en vivo y la garantía de pérdida cero de ida y vuelta\n' +
    '- [Instalación](https://veloxmark.knzn.net/es/docs/installation): Instaladores por plataforma, verificación de sumas, compilación desde el código fuente, desinstalación\n' +
    '- [Conceptos básicos](https://veloxmark.knzn.net/es/docs/basics): Anatomía de la ventana, barra lateral (archivos/esquema/búsqueda), pestañas, modos del editor\n' +
    '- [Edición en profundidad](https://veloxmark.knzn.net/es/docs/editing): Comportamiento de la vista previa en vivo, componentes de bloque, edición de tablas, asistencias de escritura\n' +
    '- [Sintaxis de Markdown](https://veloxmark.knzn.net/es/docs/markdown-syntax): Todo lo que se renderiza de forma especial: títulos, matemáticas KaTeX, Mermaid, notas destacadas, notas al pie, resaltado, front matter\n' +
    '- [Imágenes](https://veloxmark.knzn.net/es/docs/images): Resolución de rutas, tamaño `=WxH`, atributos `{align=}`/`{flip=}`, adjuntos\n' +
    '- [Preferencias](https://veloxmark.knzn.net/es/docs/preferences): Todos los ajustes con valores predeterminados: apariencia, editor, archivos, autoguardado, imágenes\n' +
    '- [Atajos de teclado](https://veloxmark.knzn.net/es/docs/key-bindings): Tablas completas de comandos/atajos para cada plataforma\n' +
    '- [Idioma y localización](https://veloxmark.knzn.net/es/docs/language): Nueve idiomas de interfaz y cómo funciona la selección de idioma\n' +
    '- [Exportar un documento](https://veloxmark.knzn.net/es/docs/export): Opciones de exportación a PDF y HTML, exportación solo de la selección\n' +
    '- [Temas](https://veloxmark.knzn.net/es/docs/themes): Temas claro y oscuro, cómo cambiarlos, cómo se aplican a los componentes\n' +
    '- [Actualización automática](https://veloxmark.knzn.net/es/docs/updates): Comportamiento de actualización por forma de instalación (NSIS/AppImage completamente automática; el resto solo notifica)\n' +
    '- [Preguntas frecuentes](https://veloxmark.knzn.net/es/docs/faq): Plataformas compatibles, licencia, solución de problemas, dónde se guardan los datos\n\n' +
    '## Descarga\n\n' +
    '- [Descargar](https://veloxmark.knzn.net/es/download): Todos los instaladores por plataforma con verificación de sumas y comportamiento de actualización\n\n' +
    '## Código fuente\n\n' +
    '- [Repositorio de GitHub](https://github.com/biao-biao-ls/veloxmark): Código fuente, seguimiento de problemas, releases (licencia MIT)\n\n' +
    '## Opcional\n\n' +
    '- [Documentación completa en texto plano](https://veloxmark.knzn.net/es/llms-full.txt): Contenido completo de la documentación concatenado para uso sin conexión con LLM\n'
}
