# VeloxMark

A Markdown desktop reader/editor with live preview, inspired by [Typora](https://typora.io). Built on Electron + CodeMirror 6.

## Features

- **Live preview (Typora-style)**: Markdown source is the single source of truth. When the cursor leaves a line, syntax markers such as `#`, `**` and `` ` `` hide and the line renders in its final style; the caret line stays in source form
- **Block rendering**: code blocks (syntax highlighting), `$$` math (KaTeX) and ```mermaid diagrams — click any block to edit its source
- **Tables**: native table editing with nested cell editors, insert/convert-to-table dialogs, column resize and alignment
- **Outline navigation**: heading tree in the sidebar with click-to-jump and current-position highlighting
- **Multi-tab editing**: open several files at once, close/reopen tabs, unsaved changes marked with `•`
- **Focus modes**: focus mode, typewriter mode and source mode
- **Light/dark theme**: toggle with `Ctrl+Shift+T`, remembered across sessions; the custom frameless title bar and in-app menus (File/Edit/View/Help) follow the theme
- **File operations**: open / save / save as; custom window controls (minimize/maximize/close)
- **Export**: PDF and HTML, including selection-only HTML export
- **Typing assists**: wrap bare URLs on paste, convert pasted HTML to Markdown
- **Task lists**: `- [ ]` renders as a clickable checkbox
- **Images**: absolute paths, relative paths (relative to the current `.md` file) and remote images
- **Auto-update**: installers check GitHub Releases and update in place (Windows NSIS and Linux AppImage)
- **Localization**: English and Chinese UI (including native menus and sample documents)

## Development

```bash
npm install
npm run dev      # development mode (hot reload)
npm run build    # build to out/
npm run typecheck
```

> If Electron binary downloads fail on restricted networks:
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

## Tech stack

- [Electron](https://www.electronjs.org) + [electron-vite](https://electron-vite.org) + React + TypeScript
- [CodeMirror 6](https://codemirror.net) — editor core; live preview via StateField decorations
- [KaTeX](https://katex.org) — math
- [mermaid](https://mermaid.js.org) — diagrams
- [highlight.js](https://highlightjs.org) — code highlighting

## Architecture

```
electron/main.ts        main process: windows, native menus, file dialogs, mdres:// image protocol
electron/preload.ts     contextBridge-safe IPC API
electron/updater.ts     auto-update routing (electron-updater / manual check)
src/renderer/src/
  App.tsx               shell: title bar, sidebar outline, file/theme state
  editor/livePreview.ts live-preview core (StateField decoration engine)
  editor/widgets.ts     code/math/mermaid/image/task widgets
  editor/setup.ts       CodeMirror extension assembly, keybindings
  editor/theme.ts       light/dark themes (CM6 theme + CSS variables)
  outline/extract.ts    heading outline extraction from the syntax tree
  i18n/                 UI dictionaries (en/zh)
```

Key design: Markdown text is always the only data source (saving writes plain `.md`, zero round-trip loss). The decoration engine rebuilds Decorations on every document/selection change: syntax markers are hidden with replace decorations, and code/math/diagram blocks are swapped for widgets. When the cursor enters a range, decorations for that range are skipped and the source form comes back.

## Documentation

The release runbook (process, artifacts, signing status, troubleshooting) lives in [CLAUDE.md](CLAUDE.md) under "Release process".

## Contributing

- **Commit messages and code comments must be written in English.**
- **Chinese (and other translations) belong only in the localization packs** — `src/renderer/src/i18n/`, `electron/shared/menuStrings.ts`, the `_EN`/`_ZH` content pairs in `src/renderer/src/content.ts`, and the localized Mermaid template bodies in `src/renderer/src/editor/mermaidTemplates.ts`. Everything else in the repository stays English-only.

## License

[MIT](LICENSE)
