# Editing in depth

VeloxMark's editor is CodeMirror 6 with a decoration engine that rebuilds the rendered
view on every document and selection change. This page explains how that behaves while
you write.

## Live preview

- When the cursor leaves a line, its syntax markers (`#`, `**`, `` ` ``, `*`, `~~`, `==`)
  are hidden with replace decorations and the line shows its final styled form.
- The **caret line always stays in source form** — you always see exactly what you're
  typing.
- Clicking into a hidden marker brings the source form back for that range.

<div class="vm-shot">

![Caret line in source form](/img/caret-source-line.png)

</div>

## Block widgets

Code blocks, `$$` math, Mermaid diagrams and images render as widgets in place of their
source. **Click any rendered block to edit its source**; leave the block and it renders
again.

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <img src="/img/math-light.png" alt="KaTeX display math" style="display:block;width:100%" />
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <img src="/img/mermaid-light.png" alt="Mermaid diagram rendered in place" style="display:block;width:100%" />
  </div>
</div>

## Tables

Tables are first-class: each cell is a nested CodeMirror editor.

- **Insert / convert** — use the insert-table dialog to create a table with a chosen row
  and column count, or convert the current paragraph to a table.
- **Column resize** — drag the column border.
- **Alignment** — set per-column alignment (left / center / right); the source separator
  row (`:---`, `:--:`, `---:`) is kept in sync.
- All edits go through transactions back into the Markdown source range the widget owns —
  the document is never mutated behind your back.

<div class="vm-shot">

![Table editing](/img/table-widget-light.png)

</div>

## Focus & typewriter modes

- **Focus mode** dims everything except the paragraph you're writing.
- **Typewriter mode** keeps the caret line locked to the vertical center.
- Both can be combined; the status bar shows `FOCUS` / `TYPEWRITER` chips while active.

<div class="vm-shot">

![Focus mode](/img/focus-mode.png)

</div>

## Typing assists

- **Paste HTML → Markdown** — rich text pasted from the clipboard is converted to clean
  Markdown.
- **Bare URLs** — a pasted bare URL is wrapped into a link automatically.
- **Task lists** — `- [ ]` renders as a clickable checkbox; click to toggle.
- **Undo/redo** — full transaction history (`Ctrl+Z` / `Ctrl+Shift+Z`).

## Multi-tab editing

Open several files at once. Tabs can be closed and reopened, unsaved changes are marked,
and the tab strip can be reordered by dragging.

## Code blocks

- Syntax highlighting via highlight.js for hundreds of languages.
- Optional line numbers, soft wrapping, and collapsing of long blocks — see
  [Preferences](./preferences).

## Exporting

Export to PDF or HTML from the File menu, including selection-only HTML export. See
[Export a document](./export).
