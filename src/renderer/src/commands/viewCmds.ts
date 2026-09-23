/**
 * View-domain commands（2B 自 commands.ts 平移）：大纲/折叠/全局搜索/写作模式/
 * 输入辅助开关/缩放/开发者工具/主题。
 */
import type { EditorView } from '@codemirror/view'
import {
  expandFolds,
  foldKey,
  getFoldedKeys,
  toggleFold,
  headingAtPos
} from '../editor/livePreview/fold'
import { extractOutline } from '../outline/extract'
import { getPreferences, setPreferences } from '../preferences/store'
import type { Command, ViewCmdOps } from './types'

export function buildViewCmds(ops: ViewCmdOps): Command[] {
  const view = (): EditorView | null => ops.viewRef.current
  return [
    // ---- View --------------------------------------------------------------
    { id: 'toggleOutline', label: 'cmd.toggleOutline', run: () => ops.toggleOutline() },
    // UX-P18 F1: fold-all / unfold-all — View menu + context-menu heading delta.
    {
      id: 'foldAll',
      label: 'cmd.foldAll',
      run: () => {
        const v = view()
        if (!v) return
        const folded = getFoldedKeys(v.state)
        const missing = extractOutline(v.state)
          .map((i) => foldKey(i.level, i.text))
          .filter((k) => !folded.has(k))
        if (missing.length) v.dispatch({ effects: missing.map((k) => toggleFold.of(k)) })
      }
    },
    {
      id: 'unfoldAll',
      label: 'cmd.unfoldAll',
      run: () => {
        const v = view()
        if (!v) return
        const folded = getFoldedKeys(v.state)
        if (folded.size) v.dispatch({ effects: expandFolds.of([...folded]) })
      }
    },
    // UX-P18 F3: keyboard fold path — Typora ⌘⌥[ / ⌘⌥] parity.
    {
      id: 'foldSection',
      label: 'cmd.foldSection',
      shortcut: 'Ctrl+Alt+[',
      bindGlobal: true,
      run: () => {
        const v = view()
        if (!v) return
        const h = headingAtPos(v.state, v.state.selection.main.head)
        if (!h) return
        const key = foldKey(h.level, h.text)
        if (!getFoldedKeys(v.state).has(key)) v.dispatch({ effects: toggleFold.of(key) })
      }
    },
    {
      id: 'unfoldSection',
      label: 'cmd.unfoldSection',
      shortcut: 'Ctrl+Alt+]',
      bindGlobal: true,
      run: () => {
        const v = view()
        if (!v) return
        const h = headingAtPos(v.state, v.state.selection.main.head)
        if (!h) return
        const key = foldKey(h.level, h.text)
        if (getFoldedKeys(v.state).has(key)) v.dispatch({ effects: toggleFold.of(key) })
      }
    },
    {
      id: 'globalSearch',
      label: 'cmd.globalSearch',
      shortcut: 'Ctrl+Shift+F',
      bindGlobal: true,
      run: () => ops.openGlobalSearch()
    },
    // P08 writing modes — state lives in preferences; the App effect pushes
    // it into the editor config facet (single write path, survives restart).
    {
      id: 'toggleFocusMode',
      label: 'cmd.toggleFocusMode',
      shortcut: 'F8',
      bindGlobal: true,
      checked: () => getPreferences().focusMode,
      run: () => setPreferences({ focusMode: !getPreferences().focusMode })
    },
    {
      id: 'toggleTypewriterMode',
      label: 'cmd.toggleTypewriterMode',
      // UX-P08: keyboard parity with Focus (F8) / Source (Ctrl+/) toggles.
      shortcut: 'F9',
      bindGlobal: true,
      checked: () => getPreferences().typewriterMode,
      run: () => setPreferences({ typewriterMode: !getPreferences().typewriterMode })
    },
    {
      id: 'toggleSourceMode',
      label: 'cmd.toggleSourceMode',
      shortcut: 'Ctrl+/',
      bindGlobal: true,
      checked: () => getPreferences().sourceMode,
      run: () => setPreferences({ sourceMode: !getPreferences().sourceMode })
    },
    // ---- UX-P01-F8: typing-assist toggles — working-state entry in View menu.
    // Checked callbacks run at menu-build time; useMenus rebuilds every render
    // and the darwin native menu re-syncs via app:setMenuCheckedIds.
    {
      id: 'toggleTypingAssists',
      label: 'cmd.toggleTypingAssists',
      checked: () => getPreferences().typingAssistsEnabled,
      run: () =>
        setPreferences({ typingAssistsEnabled: !getPreferences().typingAssistsEnabled })
    },
    {
      id: 'toggleWrapBareUrlOnPaste',
      label: 'cmd.toggleWrapBareUrlOnPaste',
      checked: () => getPreferences().wrapBareUrlOnPaste,
      run: () => setPreferences({ wrapBareUrlOnPaste: !getPreferences().wrapBareUrlOnPaste })
    },
    {
      id: 'togglePasteHtmlToMd',
      label: 'cmd.togglePasteHtmlToMd',
      checked: () => getPreferences().pasteHtmlToMd,
      run: () => setPreferences({ pasteHtmlToMd: !getPreferences().pasteHtmlToMd })
    },
    { id: 'zoomIn', label: 'cmd.zoomIn', run: () => window.api.windowZoom('in') },
    { id: 'zoomOut', label: 'cmd.zoomOut', run: () => window.api.windowZoom('out') },
    { id: 'zoomReset', label: 'cmd.zoomReset', run: () => window.api.windowZoom('reset') },
    {
      id: 'toggleDevTools',
      label: 'cmd.toggleDevTools',
      run: () => window.api.windowToggleDevTools()
    },
    {
      id: 'toggleTheme',
      label: 'cmd.toggleTheme',
      shortcut: 'Ctrl+Shift+T',
      bindGlobal: true,
      run: () => ops.toggleTheme()
    }
  ]
}
