# Key bindings

VeloxMark is keyboard-first. On Windows and Linux shortcuts use `Ctrl`; on macOS the
same bindings use `Cmd` (shown in menus with the ⌘ glyph), and `Ctrl`-prefixed items
below read `Cmd` accordingly. Shortcuts are also shown next to each command in the
in-app menus.

## File

| Command | Shortcut | Notes |
| --- | --- | --- |
| New | `Ctrl+N` | New untitled tab |
| Open… | `Ctrl+O` | Open a `.md` file |
| Open Folder… | `Ctrl+Shift+O` | Load a workspace into the sidebar |
| Quick Open… | `Ctrl+P` | Fuzzy file picker in the workspace |
| Save | `Ctrl+S` | |
| Save As… | `Ctrl+Shift+S` | |
| Preferences… | `Ctrl+,` | |
| Export PDF… | menu | [Export](./export) |
| Export HTML… | menu | [Export](./export) |

## Edit

| Command | Shortcut | Notes |
| --- | --- | --- |
| Undo | `Ctrl+Z` | |
| Redo | `Ctrl+Y` | |
| Cut / Copy / Paste | `Ctrl+X` / `Ctrl+C` / `Ctrl+V` | |
| Copy as Rich Text | `Ctrl+Shift+C` | Rich text on the clipboard |
| Copy as HTML / Markdown / Plain Text | menu | Context menu → Copy As |
| Select All | `Ctrl+A` | |
| Find | `Ctrl+F` | In-document search |
| Export Selection as HTML… | menu | Selection-only HTML export |
| Format Document | `Shift+Alt+F` | Normalize Markdown source |

## Format

| Command | Shortcut | Notes |
| --- | --- | --- |
| Bold | `Ctrl+B` | |
| Italic | `Ctrl+I` | |
| Inline Code | `Ctrl+E` | |
| Code Block / Strikethrough / Highlight | menu | |
| Clear Formatting | menu | |
| Heading 1–6, Paragraph, Quote | menu | |
| Bulleted / Numbered / Task List | menu | |
| Promote / Exit List | menu | |
| Open Link | `Ctrl+Shift+L` | Opens the link under the cursor |
| Insert Link… | menu | |

## Tabs

| Command | Shortcut | Notes |
| --- | --- | --- |
| Next Tab | `Ctrl+Tab` | |
| Close Tab | `Ctrl+W` | Prompts to save unsaved changes |
| Reopen Closed Tab | `Ctrl+Shift+T` | |

## View & modes

| Command | Shortcut | Notes |
| --- | --- | --- |
| Toggle Sidebar | `Ctrl+Shift+B` | |
| Search in Folder… | `Ctrl+Shift+F` | |
| Fold / Unfold Section | `Ctrl+Alt+[` / `Ctrl+Alt+]` | |
| Fold All / Unfold All | menu | |
| Focus Mode | `F8` | Dim everything but the current region |
| Typewriter Mode | `F9` | Lock the caret line to the center |
| Source Mode | `Ctrl+/` | Raw Markdown |
| Toggle Theme | menu | Light / dark |
| Zoom In / Out / Reset | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | |
| Toggle Developer Tools | `F12` | |

## Insert

| Command | Shortcut | Notes |
| --- | --- | --- |
| Insert Table… / Convert Selection to Table… | menu | |
| Mermaid Diagram… | menu | Insert from a template |
| Insert Callout… | menu | |

## Editor-level bindings

These work while typing in the editor:

| Shortcut | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Indent / outdent (list items) |
| `Enter` on an empty list item | Exit the list |
| `Ctrl+B` / `Ctrl+I` / `Ctrl+E` | Toggle bold / italic / inline code |
| `Ctrl` + click a link | Open the link |
| Click a rendered block | Edit its source |
| Click a task checkbox | Toggle `[ ]` / `[x]` |

## Table editing

While editing a table cell:

| Shortcut | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Next / previous cell |
| `Enter` / `Shift+Enter` | Cell below / above |
| `Ctrl+Enter` / `Ctrl+Shift+Enter` | Insert row below / above |
| `Ctrl+Shift+←` / `→` | Insert column left / right |
| `Alt+↑↓←→` | Move row / column |
| `Escape` | Leave table editing |
