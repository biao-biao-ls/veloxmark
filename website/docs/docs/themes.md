---
title: Themes
description: VeloxMark light and dark themes — switching with one click, persistence across sessions, and how themes apply to code, math and diagram widgets.
keywords: [Markdown editor dark mode, light theme, dark theme, editor themes, theme toggle]
---

# Themes

VeloxMark ships two first-class themes — light and dark — tuned for long writing
sessions. Both cover the editor chrome, the syntax colors and the rendered-block widgets
(math, diagrams, code, tables).

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">light</span>
      </div>
      <img src="/img/hero-light.png" alt="VeloxMark light theme" />
    </div>
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">dark</span>
      </div>
      <img src="/img/hero-dark.png" alt="VeloxMark dark theme" />
    </div>
  </div>
</div>

## Switching themes

- Menu: **View → Toggle theme** (also available as the "Toggle Theme" command).
- Or pick `light` / `dark` / `system` explicitly in Preferences (theme mode).
- The choice is remembered across sessions.

The custom frameless title bar and the in-app menus (File / Edit / View / Insert / Help)
follow the active theme.

## Dark theme code example

<div class="vm-shot">

![Code block in dark theme](/img/code-dark.png)

</div>

## How themes are applied

The editor is [CodeMirror 6](https://codemirror.net); each theme is a CM6 theme plus CSS
variables covering the app shell. Rendered widgets (KaTeX, Mermaid, highlight.js) pick up
the same palette, so a code block or diagram never looks out of place.
