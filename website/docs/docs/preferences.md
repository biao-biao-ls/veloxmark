---
title: Preferences
description: All VeloxMark settings with defaults — theme, editor fonts, typing assists, auto-save and crash recovery, images and attachments, language.
keywords: [VeloxMark settings, editor preferences, auto-save, crash recovery, font size, attachment folder]
---

# Preferences

Open preferences with `Ctrl+,` (`Cmd+,` on macOS) or via the in-app **File →
Preferences** menu. Settings are persisted across sessions.

## Appearance

| Setting | Default | Description |
| --- | --- | --- |
| Theme | System | `light` / `dark` / follow the OS. Toggled in the View menu. |
| Editor font | System stack | Font family of the writing surface. |
| Font size | 16 | Editor font size in pixels. |
| Line height | 1.6 | Editor line height. |
| Content column width | 0 (auto) | Max line width of the writing column; `0` lets the app choose. |
| Show status bar | On | Cursor position, counts and mode indicators. |
| Sidebar open by default | On | When no previous session is remembered. |

## Editor

| Setting | Default | Description |
| --- | --- | --- |
| Typing assists | On | List continuation, heading level-up, paste transforms. |
| Wrap bare URLs on paste | On | Turn a pasted bare URL into a Markdown link. |
| Convert HTML on paste | On | Convert pasted rich text to clean Markdown. |
| Format on save | Off | Normalize Markdown (spacing, list markers, table alignment) before writing. |
| Show line numbers | Off | Line-number gutter in the editor. |
| Line numbers in code blocks | Off | Render line numbers inside code-block widgets. |
| Soft-wrap code blocks | On | Wrap long lines inside code blocks. |
| Code block collapse threshold | 20 lines | Longer blocks collapse with an expand control; `0` disables. |
| Focus mode | Off | Dim everything except the current region. |
| Typewriter mode | Off | Keep the caret line locked to the vertical center. |
| Source mode | Off | Always show raw Markdown. |

## Files

| Setting | Default | Description |
| --- | --- | --- |
| Auto-save | Debounce (3 s) | `off` / `debounce` (after typing stops) / `interval` (every N minutes). |
| Auto-save delay | 3 s | Debounce delay for the debounce mode. |
| Auto-save interval | 5 min | Interval for the interval mode. |
| Crash recovery drafts | On | Keep drafts of unsaved changes and offer recovery after a crash. |
| Restore last session | On | Reopen tabs, folders and cursor position on startup. |
| Show hidden files | Off | Show dot-files in the file tree. |
| Ignored names | `node_modules`, `.git`, … | Names hidden from the file tree. |

## Images & attachments

| Setting | Default | Description |
| --- | --- | --- |
| Attachment folder | `assets` | Folder (relative to the document) for pasted/inserted images. |
| Image file naming | Timestamp | Timestamped names, or keep the original filename. |
| Copy external images | On | Copy images from outside the document folder into attachments. |
| Download remote images | Off | Fetch remote image URLs into attachments. |

## Language

| Setting | Default | Description |
| --- | --- | --- |
| UI language | System | Follow the OS locale or pin one of nine languages. See [Language & localization](./language). |

## Links

| Setting | Default | Description |
| --- | --- | --- |
| Confirm external links | On | Ask before opening a link in the browser. |
