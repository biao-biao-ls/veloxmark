# Images

VeloxMark resolves images the way a Markdown file on disk should — relative to the file
you are editing.

## Supported paths

| Form | Example | Resolved against |
| --- | --- | --- |
| Relative path | `![alt](./img/chart.png)` | Directory of the current `.md` file |
| Absolute path | `![alt](C:\pics\a.png)` / `![alt](/home/me/a.png)` | Filesystem root |
| Remote URL | `![alt](https://example.com/a.png)` | Fetched over the network |
| Data URI | `![alt](data:image/png;base64,…)` | Embedded inline |

Relative paths are the portable choice — move the folder containing your `.md` and its
images together and everything keeps working.

## Size & attributes

An optional `=WxH` suffix after the URL sets the rendered dimensions, and `{…}` groups
after the closing paren set alignment and flipping:

```markdown
![logo](./logo.png =128x128)
![banner](./banner.png =800x200){align=center}{flip=h}
```

| Attribute | Values | Effect |
| --- | --- | --- |
| `=WxH` | e.g. `=128x128` | Display size in pixels |
| `{align=…}` | `left`, `center`, `right` | Horizontal alignment |
| `{flip=…}` | `h`, `v`, `hv` | Mirror horizontally / vertically / both |

Rendered images can also be **drag-resized** with the mouse (emits a `%` width), and the
image widget offers align, flip, reset size, edit URL and "Show in file manager".

## Click to edit

Images render as widgets. Click the image to edit its Markdown source; leave the block and
it renders again — same behavior as code, math and diagram blocks.

## Local security

Local images are served through the app's internal `mdres://` protocol rather than raw
`file://` access, so a document can only display images the app deliberately exposes.
