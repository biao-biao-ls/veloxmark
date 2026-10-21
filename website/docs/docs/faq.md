---
title: FAQ
description: VeloxMark FAQ — supported platforms, licensing, how live preview works, file round-tripping, data locations, macOS Gatekeeper and update behavior.
keywords: [VeloxMark FAQ, Markdown editor FAQ, live preview questions, VeloxMark troubleshooting]
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What platforms are supported?","acceptedAnswer":{"@type":"Answer","text":"macOS (Apple Silicon and Intel), Windows 10/11 (x64 and ARM64) and Linux (x64 and arm64 — AppImage, deb, rpm, tar.gz; snap is x64 only)."}},{"@type":"Question","name":"Is VeloxMark free?","acceptedAnswer":{"@type":"Answer","text":"Yes. VeloxMark is open source under the MIT License. No account, no subscription, no telemetry."}},{"@type":"Question","name":"What is live preview and how is it different from a split view?","acceptedAnswer":{"@type":"Answer","text":"There is no preview pane. The editor renders Markdown in place: when the cursor leaves a line, syntax markers hide and the line shows its final form. The caret line always stays in source form, and clicking any rendered block brings its raw Markdown back for editing. Markdown source is the only data source — saving writes plain .md with zero round-trip loss."}},{"@type":"Question","name":"Does VeloxMark modify my Markdown files when saving?","acceptedAnswer":{"@type":"Answer","text":"No. Saving writes the source text back out unchanged. All rendering is decoration."}},{"@type":"Question","name":"Which Markdown syntax is supported?","acceptedAnswer":{"@type":"Answer","text":"CommonMark + GFM (tables, task lists, strikethrough), plus KaTeX math, Mermaid diagrams, callouts, footnotes and highlighted text."}},{"@type":"Question","name":"Can I use VeloxMark for note management?","acceptedAnswer":{"@type":"Answer","text":"VeloxMark is a focused Markdown reader/editor — open folders and files, use the outline and search, but there is no knowledge-management layer. Your files stay plain .md on disk, so any other tool can pick them up."}},{"@type":"Question","name":"How do I report a bug?","acceptedAnswer":{"@type":"Answer","text":"Open an issue on GitHub with the app version (Help menu), your OS, steps to reproduce and the Markdown that misbehaves."}},{"@type":"Question","name":"Where are my drafts and settings stored?","acceptedAnswer":{"@type":"Answer","text":"Preferences, drafts and session state live in the standard per-user application data directory (Electron userData): Windows %APPDATA%\\VeloxMark, macOS ~/Library/Application Support/VeloxMark, Linux ~/.config/VeloxMark. Documents themselves are never moved or copied."}},{"@type":"Question","name":"Why does macOS say the app is from an unidentified developer?","acceptedAnswer":{"@type":"Answer","text":"Release builds are currently unsigned. Run xattr -d com.apple.quarantine /Applications/VeloxMark.app once after installing."}},{"@type":"Question","name":"The app doesn’t auto-update on my platform — is that expected?","acceptedAnswer":{"@type":"Answer","text":"Yes. Full auto-update is enabled on Windows NSIS installs and Linux AppImage; other install forms are notify-only, and macOS currently falls back to opening the releases page because the builds are unsigned."}}]}'
---

# Frequently Asked Questions (FAQ)

### What platforms are supported?

macOS (Apple Silicon and Intel), Windows 10/11 (x64 and ARM64) and Linux (x64 and arm64 —
AppImage, deb, rpm, tar.gz; snap is x64 only). See [Installation](./installation).

### Is VeloxMark free?

Yes. VeloxMark is open source under the
[MIT License](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE). No account,
no subscription, no telemetry.

### What is "live preview" and how is it different from a split view?

There is no preview pane. The editor renders your Markdown **in place**: when the cursor
leaves a line, syntax markers like `#`, `**` and `` ` `` hide and the line shows its final
form. The caret line always stays in source form, and clicking any rendered block (code,
math, diagram, table, image) brings its raw Markdown back for editing. Markdown source is
the only data source — saving writes plain `.md` with zero round-trip loss.

### Does VeloxMark modify my Markdown files when saving?

No. Saving writes the source text back out unchanged. All rendering is decoration.

### Which Markdown syntax is supported?

CommonMark + GFM (tables, task lists, strikethrough), plus KaTeX math, Mermaid diagrams,
callouts, footnotes and `==highlights==`. Full reference:
[Markdown syntax](./markdown-syntax).

### Can I use VeloxMark for note management?

VeloxMark is a focused Markdown reader/editor — open folders and files, use the outline
and search, but there is no knowledge-management layer (no tags, backlinks or database).
Your files stay plain `.md` on disk, so any other tool can pick them up.

### How do I report a bug?

Open an issue on [GitHub](https://github.com/biao-biao-ls/veloxmark/issues) with the app
version (Help menu), your OS, steps to reproduce and the Markdown that misbehaves.

### Where are my drafts and settings stored?

Preferences, drafts and session state live in the standard per-user application data
directory (Electron `userData`): Windows `%APPDATA%\VeloxMark`, macOS
`~/Library/Application Support/VeloxMark`, Linux `~/.config/VeloxMark`. Documents
themselves are never moved or copied — you edit files where they are.

### Why does macOS say the app is from an unidentified developer?

Release builds are currently unsigned. Run
`xattr -d com.apple.quarantine /Applications/VeloxMark.app` once after installing — see
[Installation](./installation#macos).

### The app doesn't auto-update on my platform — is that expected?

Yes. Full auto-update is enabled on Windows NSIS installs and Linux AppImage; other
install forms are notify-only, and macOS currently falls back to opening the releases page
because the builds are unsigned. Details: [Auto-update](./updates).
