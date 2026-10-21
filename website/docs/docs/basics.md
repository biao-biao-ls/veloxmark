---
title: Basics
description: The VeloxMark window at a glance — title bar, sidebar (files, outline, search), tabs, editor modes, opening and saving files.
keywords: [VeloxMark basics, Markdown editor interface, outline panel, tabs, focus mode, typewriter mode, source mode]
---

# Basics

VeloxMark opens on a welcome document that doubles as a feature tour. This page walks
through the window, the sidebar, tabs and the editor modes.

## The window

<div class="vm-shot">

![VeloxMark window](/img/hero-light.png)

</div>

- **Title bar** — custom frameless bar with the app menu (File / Edit / View / Insert /
  Help) and window controls. Follows the light/dark theme.
- **Sidebar** — three panels: **Files** (folder workspace), **Outline** (heading tree of
  the active document) and **Search** (find in folder).
- **Tab bar** — one tab per open document, with unsaved changes marked.
- **Editor** — the live-preview writing surface.
- **Status bar** — cursor position, word / character / line counts, and focus-mode
  indicators when active.

## Sidebar

- **Files** — open a folder and browse its Markdown files; click to open in a tab.
- **Outline** — heading tree of the active document with click-to-jump and
  current-position highlighting.
- **Search** — full-text search across the open folder, with replace.

## Tabs

- Open several files at once; each gets a tab.
- Unsaved changes are marked on the tab.
- Close and reopen tabs; a closed tab can be restored.
- Drag tabs to reorder.

## Editor modes

| Mode | What it does |
| --- | --- |
| **Live preview** (default) | Markdown renders in place; the caret line stays in source form |
| **Source mode** | Raw Markdown all the time, for full control |
| **Focus mode** | Everything except the current line dims |
| **Typewriter mode** | The current line stays locked to the vertical center |

Toggle the theme from the View menu. Full command list: [Key bindings](./key-bindings).

## Opening & saving

- **Open** a `.md` file (`Ctrl+O` / `Cmd+O`) or open a folder from the File menu.
- **Save** (`Ctrl+S` / `Cmd+S`) writes the plain source back — zero round-trip loss.
- **Save as** writes a copy under a new name.
- Unsaved work is kept as a draft and can be recovered.

## Next steps

- [Editing in depth](./editing) — how live preview behaves while you type.
- [Markdown syntax](./markdown-syntax) — everything that renders specially.
- [Preferences](./preferences) — tune the editor to your taste.
