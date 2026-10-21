# Export a document

VeloxMark exports from the **Markdown source** — not from the editor DOM — so the output
matches your document exactly. Available from the File menu: **Export → PDF…** or
**Export → HTML…**. Both open a shared export dialog.

## Options

| Group | Setting | Values |
| --- | --- | --- |
| Page (PDF) | Paper size | A4, Letter |
| Page (PDF) | Margins | Normal, Narrow |
| Page (PDF) | Header and footer | On / off — header shows the document title / file name, footer shows `page / total` |
| Style | Theme | Follow the current theme, or force light |
| Images | Embed as base64 / keep relative paths | PDF always embeds |
| Math | KaTeX fonts | Embed (offline-ready) or CDN fallback (smaller file) |

## What gets rendered

The full pipeline reproduces everything the live preview shows:

- Headings, lists, task lists (as checked checkboxes), tables with alignment
- Code with highlight.js syntax colors
- **KaTeX math** as real typeset math
- **Mermaid diagrams** as inline SVG
- Callouts, footnotes (numbered with back-references), `==highlights==`, superscript,
  subscript, abbreviations and definition lists
- Images with size / alignment / flip attributes, resolved relative to the document and
  inlined where the option says so
- Front matter `title` becomes the document H1

PDF generation renders the HTML in a hidden sandboxed window, waits for fonts and images,
then prints to PDF with backgrounds.

## Selection-only export

**Edit → Export Selection as HTML…** exports just the selected range as a standalone HTML
file (with nothing selected, the whole document is used). The same selection-or-document
scope applies to **Copy as Rich Text** and **Copy as HTML**.

## Round-trip guarantee

Export never modifies your file. The `.md` on disk remains the single source of truth;
the exported PDF/HTML is only a rendering of it.
