/**
 * Format-domain commands（2B 自 commands.ts 平移）：formatDocument + 行内格式 +
 * P27 context-menu 命令面（lift/headingN/paragraph/lists/links）。
 */
import type { EditorView } from '@codemirror/view'
import { dialog } from '../components/Dialog'
import { wrapSelectionWith } from '../editor/assists'
import {
  clearInlineFormat,
  convertList,
  liftBlock,
  setHeadingLevel,
  toggleBlockquote,
  wrapFencedCode
} from '../editor/contextMenu/transforms'
import { t } from '../i18n'
import type { Command, FormatCmdOps } from './types'

export function buildFormatCmds(ops: FormatCmdOps): Command[] {
  const view = (): EditorView | null => ops.viewRef.current
  return [
    {
      id: 'formatDocument',
      label: 'cmd.formatDocument',
      shortcut: 'Shift+Alt+F',
      bindGlobal: true,
      run: () => ops.formatDocument()
    },
    // ---- Inline format + P27 context-menu command surface -------------------
    // Probe/rubric contract ids: bold/italic/strikethrough/inlineCode/code/
    // highlight/openLink/copyLinkAddress/clearFormat/lift/headingN/paragraph.
    // Keybindings stay with the CM6 assists keymap (Prec.highest in
    // editor/assists); no bindGlobal. The Format submenu and the P27
    // context-menu registry share these ids.
    {
      id: 'bold',
      label: 'cmd.bold',
      shortcut: 'Ctrl+B',
      run: () => {
        const v = view()
        if (v) wrapSelectionWith(v, '**')
      }
    },
    {
      id: 'italic',
      label: 'cmd.italic',
      shortcut: 'Ctrl+I',
      run: () => {
        const v = view()
        if (v) wrapSelectionWith(v, '*')
      }
    },
    {
      id: 'inlineCode',
      label: 'cmd.inlineCode',
      shortcut: 'Ctrl+E',
      run: () => {
        const v = view()
        if (v) wrapSelectionWith(v, '`')
      }
    },
    {
      id: 'strikethrough',
      label: 'cmd.strikethrough',
      run: () => {
        const v = view()
        if (v) wrapSelectionWith(v, '~~')
      }
    },
    {
      id: 'highlight',
      label: 'cmd.highlight',
      run: () => {
        const v = view()
        if (v) wrapSelectionWith(v, '==')
      }
    },
    {
      id: 'code',
      label: 'cmd.code',
      run: () => {
        const v = view()
        if (v) wrapFencedCode(v)
      }
    },
    {
      id: 'clearFormat',
      label: 'cmd.clearFormat',
      run: () => {
        const v = view()
        if (v) clearInlineFormat(v)
      }
    },
    {
      id: 'lift',
      label: 'cmd.lift',
      run: () => {
        const v = view()
        if (v) liftBlock(v)
      }
    },
    // Heading/paragraph/list transforms — the 段落▶ submenu + probe contract.
    // NOTE: probe static contract regex-reads `id: '…'` — keep these literal
    // (a `heading${n}` template id is invisible to cdp-ux-p27's scanner).
    { id: 'heading1', label: 'cmd.heading1', run: (): void => { const v = view(); if (v) setHeadingLevel(v, 1) } },
    { id: 'heading2', label: 'cmd.heading2', run: (): void => { const v = view(); if (v) setHeadingLevel(v, 2) } },
    { id: 'heading3', label: 'cmd.heading3', run: (): void => { const v = view(); if (v) setHeadingLevel(v, 3) } },
    { id: 'heading4', label: 'cmd.heading4', run: (): void => { const v = view(); if (v) setHeadingLevel(v, 4) } },
    { id: 'heading5', label: 'cmd.heading5', run: (): void => { const v = view(); if (v) setHeadingLevel(v, 5) } },
    { id: 'heading6', label: 'cmd.heading6', run: (): void => { const v = view(); if (v) setHeadingLevel(v, 6) } },
    {
      id: 'paragraph',
      label: 'cmd.paragraph',
      run: () => {
        const v = view()
        if (v) setHeadingLevel(v, 0)
      }
    },
    {
      id: 'blockquote',
      label: 'cmd.blockquote',
      run: () => {
        const v = view()
        if (v) toggleBlockquote(v)
      }
    },
    {
      id: 'listUl',
      label: 'cmd.listUl',
      run: () => {
        const v = view()
        if (v) convertList(v, 'ul')
      }
    },
    {
      id: 'listOl',
      label: 'cmd.listOl',
      run: () => {
        const v = view()
        if (v) convertList(v, 'ol')
      }
    },
    {
      id: 'taskList',
      label: 'cmd.taskList',
      run: () => {
        const v = view()
        if (v) convertList(v, 'task')
      }
    },
    // Link ops — menu-bar silent without a link at the cursor; the context
    // menu passes the detected href straight to the runtime openLink path.
    {
      id: 'openLink',
      label: 'cmd.openLink',
      shortcut: 'Ctrl+Shift+L',
      bindGlobal: true,
      run: () => ops.openLinkAtCursor()
    },
    {
      id: 'copyLinkAddress',
      label: 'cmd.copyLinkAddress',
      run: () => ops.copyLinkAddressAtCursor()
    },
    {
      id: 'insertLink',
      label: 'cmd.insertLink',
      run: () => {
        const v = view()
        if (!v) return
        const sel = v.state.selection.main
        const text = v.state.sliceDoc(sel.from, sel.to)
        if (!text) {
          ops.showToast(t('ctx.selectTextForLink'))
          return
        }
        void dialog
          .prompt({
            title: t('cmd.insertLink'),
            message: t('ctx.linkUrlPrompt'),
            confirmLabel: t('cmd.insertLink')
          })
          .then((url) => {
            if (!url) return
            v.dispatch({
              changes: { from: sel.from, to: sel.to, insert: `[${text}](${url})` },
              selection: { anchor: sel.from, head: sel.from + text.length + url.length + 4 },
              userEvent: 'input.contextMenu.insertLink'
            })
          })
      }
    }
  ]
}
