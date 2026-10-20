import { openSearchPanel } from '@codemirror/search'
import { redo } from '@codemirror/commands'
import type { EditorView } from '@codemirror/view'
import { runMenuPaste } from '../editor/assists'
import {
  markdownToPlainText,
  selectionOrDocMarkdown
} from '../editor/contextMenu/transforms'
import {
  copyHtmlToClipboard,
  copyRichTextToClipboard,
  exportSelectionHtmlFile
} from '../export/copyRichText'
import { livePreviewConfigFacet } from '../editor/livePreview'
import { undoWithAck } from '../hooks/useToast'
import { t } from '../i18n'
import type { Command, EditCmdOps } from './types'

export function buildEditCmds(ops: EditCmdOps): Command[] {
  const view = (): EditorView | null => ops.viewRef.current
  return [
    {
      id: 'undo',
      label: 'cmd.undo',
      shortcut: 'Ctrl+Z',
      run: () => {
        const v = view()
        if (v) undoWithAck(v)
      }
    },
    {
      id: 'redo',
      label: 'cmd.redo',
      shortcut: 'Ctrl+Y',
      run: () => {
        const v = view()
        if (v) redo(v)
      }
    },
    {
      id: 'cut',
      label: 'cmd.cut',
      shortcut: 'Ctrl+X',
      run: () => {
        const v = view()
        if (!v) return
        const { from, to } = v.state.selection.main
        if (from === to) return
        void window.api.clipboardWrite(v.state.sliceDoc(from, to))
        v.dispatch({ changes: { from, to } })
      }
    },
    {
      id: 'copy',
      label: 'cmd.copy',
      shortcut: 'Ctrl+C',
      run: () => {
        const v = view()
        if (!v) return
        const { from, to } = v.state.selection.main
        if (from !== to) void window.api.clipboardWrite(v.state.sliceDoc(from, to))
      }
    },
    {
      id: 'paste',
      label: 'cmd.paste',
      shortcut: 'Ctrl+V',
      run: () => {
        const v = view()
        if (!v) return
        void runMenuPaste(v, () =>
          v.state.facet(livePreviewConfigFacet).baseDir
            ? Promise.resolve(true)
            : ops.saveFileAs()
        )
      }
    },
    {
      id: 'copyRichText',
      label: 'cmd.copyRichText',
      shortcut: 'Ctrl+Shift+C',
      bindGlobal: true,
      run: () => {
        const v = view()
        if (!v) return
        void copyRichTextToClipboard(v).then((ok) => {
          if (ok) ops.showToast(t('toast.copiedRich'))
        })
      }
    },
    {
      id: 'copyAsHtml',
      label: 'cmd.copyAsHtml',
      run: () => {
        const v = view()
        if (!v) return
        void copyHtmlToClipboard(v).then((ok) => {
          if (ok) ops.showToast(t('toast.copiedHtml'))
        })
      }
    },
    {
      id: 'exportSelectionHtml',
      label: 'cmd.exportSelectionHtml',
      run: () => {
        const v = view()
        if (!v) return
        void exportSelectionHtmlFile(v).then((ok) => {
          if (ok) ops.showToast(t('toast.exportedSelection'))
        })
      }
    },
    {
      id: 'selectAll',
      label: 'cmd.selectAll',
      shortcut: 'Ctrl+A',
      run: () => {
        const v = view()
        if (!v) return
        v.dispatch({ selection: { anchor: 0, head: v.state.doc.length } })
      }
    },
    {
      id: 'find',
      label: 'cmd.find',
      shortcut: 'Ctrl+F',
      run: () => {
        const v = view()
        if (v) openSearchPanel(v)
      }
    },
    {
      id: 'copyAsMarkdown',
      label: 'cmd.copyAsMarkdown',
      run: () => {
        const v = view()
        if (!v) return
        void window.api.clipboardWrite(selectionOrDocMarkdown(v)).then(() => ops.showToast(t('toast.copiedMarkdown')))
      }
    },
    {
      id: 'copyAsPlainText',
      label: 'cmd.copyAsPlainText',
      run: () => {
        const v = view()
        if (!v) return
        void window.api
          .clipboardWrite(markdownToPlainText(selectionOrDocMarkdown(v)))
          .then(() => ops.showToast(t('toast.copiedPlain')))
      }
    }
  ]
}
