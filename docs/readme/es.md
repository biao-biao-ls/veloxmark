# VeloxMark

Escribe en Markdown — todo lo demás es decoración.

[English](../../README.md) · [简体中文](zh.md) · [日本語](ja.md) · [한국어](ko.md) · **Español** · [Português](pt.md) · [Français](fr.md) · [Deutsch](de.md) · [Русский](ru.md)

VeloxMark es un lector y editor de Markdown de escritorio, gratuito y de código abierto, con vista previa en vivo. Busca la sensación de escritura sin fricción popularizada por [Typora](https://typora.io), manteniendo los archivos `.md` de texto plano totalmente portátiles — construido sobre Electron y CodeMirror 6, para macOS, Windows y Linux.

![VeloxMark tema claro](../../website/docs/public/img/hero-light.png)

- Sitio web y documentación: https://veloxmark.knzn.net
- Descargas: https://github.com/biao-biao-ls/veloxmark/releases

## Funciones

- **Vista previa en vivo (estilo Typora)**: el texto fuente Markdown es la única fuente de datos. Cuando el cursor sale de una línea, las marcas de sintaxis como `#`, `**` y `` ` `` se ocultan y la línea se muestra con su estilo final; la línea del cursor permanece en forma de fuente
- **Renderizado de bloques**: bloques de código (resaltado de sintaxis), matemáticas `$$` (KaTeX) y diagramas ```` ```mermaid ```` — haz clic en cualquier bloque para editar su fuente
- **Tablas**: edición de tablas nativa con editores de celda anidados, diálogos para insertar/convertir en tabla, redimensionar columnas y alineación
- **Navegación por esquema**: árbol de encabezados en la barra lateral con salto al hacer clic y resaltado de la posición actual
- **Edición con varias pestañas**: abre varios archivos a la vez, cierra/restaura pestañas; los cambios sin guardar se marcan con `•`
- **Modos de concentración**: modo enfoque, modo máquina de escribir y modo fuente
- **Tema claro/oscuro**: alterna desde el menú **Ver → Cambiar tema** y se recuerda entre sesiones; la barra de título sin marco y los menús de la aplicación (Archivo/Editar/Ver/Ayuda) siguen el tema
- **Operaciones de archivos**: abrir / guardar / guardar como; controles de ventana personalizados (minimizar/maximizar/cerrar)
- **Exportación**: PDF y HTML, incluida la exportación de solo la selección a HTML
- **Asistencia de escritura**: convierte en enlace las URL pegadas y transforma el HTML pegado en Markdown
- **Listas de tareas**: `- [ ]` se muestra como una casilla de verificación clicable
- **Imágenes**: rutas absolutas, rutas relativas (respecto al archivo `.md` actual) e imágenes remotas
- **Actualización automática**: los instaladores consultan GitHub Releases y se actualizan en el sitio (Windows NSIS y Linux AppImage)
- **Localización**: interfaz en español, English, 简体中文, 日本語, 한국어, Português, Français, Deutsch y Русский (con menús nativos y documentos de ejemplo)

## Instalación

Descarga la compilación de tu plataforma desde la [página de releases](https://github.com/biao-biao-ls/veloxmark/releases/latest):

- **Windows** — instalador NSIS (con actualización automática) o zip portable
- **macOS** — dmg y zip (compilaciones sin firmar). En el primer inicio, haz clic derecho → **Abrir**, o quita la marca de cuarentena: `xattr -d com.apple.quarantine /Applications/VeloxMark.app`
- **Linux** — AppImage (con actualización automática), deb, rpm, tar.gz o snap

## Desarrollo

```bash
npm install
npm run dev      # modo de desarrollo (recarga en caliente)
npm run build    # compilar a out/
npm run typecheck
```

> Si la descarga de los binarios de Electron falla en redes restringidas:
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

## Stack tecnológico

- [Electron](https://www.electronjs.org) + [electron-vite](https://electron-vite.org) + React + TypeScript
- [CodeMirror 6](https://codemirror.net) — núcleo del editor; vista previa en vivo mediante decoraciones StateField
- [KaTeX](https://katex.org) — matemáticas
- [mermaid](https://mermaid.js.org) — diagramas
- [highlight.js](https://highlightjs.org) — resaltado de código

## Arquitectura

```
electron/main.ts        main process: windows, native menus, file dialogs, mdres:// image protocol
electron/preload.ts     contextBridge-safe IPC API
electron/updater.ts     auto-update routing (electron-updater / manual check)
src/renderer/src/
  App.tsx               shell: title bar, sidebar outline, file/theme state
  editor/livePreview/   live-preview core (StateField decoration engine)
  editor/widgets.ts     code/math/mermaid/image/task widgets
  editor/setup.ts       CodeMirror extension assembly, keybindings
  editor/theme.ts       light/dark themes (CM6 theme + CSS variables)
  outline/extract.ts    heading outline extraction from the syntax tree
  i18n/                 UI dictionaries (en/zh/ja/ko/es/pt/fr/de/ru)
```

Diseño clave: el texto Markdown es siempre la única fuente de datos (guardar escribe un `.md` plano, sin pérdida en el viaje de ida y vuelta). El motor de decoraciones reconstruye las Decorations en cada cambio de documento/selección: las marcas de sintaxis se ocultan con decoraciones replace y los bloques de código/matemáticas/diagramas se sustituyen por widgets. Cuando el cursor entra en un rango, se omiten las decoraciones de ese rango y vuelve la forma fuente.

## Documentación

La documentación completa de usuario está en el [sitio web](https://veloxmark.knzn.net/es/docs/). El manual de releases (proceso, artefactos, estado de firma, solución de problemas) está en [CLAUDE.md](../../CLAUDE.md), en la sección "Release process".

## Contribuir

- **Los mensajes de commit y los comentarios de código deben escribirse en inglés.**
- **Las traducciones solo pertenecen a los paquetes de localización** — un paquete (archivo o directorio) por idioma:
  - `src/renderer/src/i18n/<lang>.ts` — diccionario de la interfaz y nombres propios de los idiomas
  - `electron/shared/menuStrings/<lang>.ts` — textos de los menús nativos
  - `src/renderer/src/content/<lang>.ts` — documentos de bienvenida/ayuda
  - `src/renderer/src/editor/mermaidTemplates/<lang>.ts` — cuerpos de las plantillas Mermaid
  - `docs/readme/<lang>.md` — traducciones de este README
  - `website/docs/<lang>/` y `website/docs/.vitepress/locales/<lang>.ts` — páginas y textos de interfaz del sitio web

  Todo lo demás del repositorio se mantiene solo en inglés.

## Licencia

[MIT](../../LICENSE)
