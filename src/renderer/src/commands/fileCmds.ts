/**
 * File-domain commands（2B 自 commands.ts 平移）+ showHelp（loadContent 家族）。
 */
import { getHelpMd } from '../content'
import { getLang } from '../i18n'
import type { Command, FileCmdOps } from './types'

export function buildFileCmds(ops: FileCmdOps): Command[] {
  return [
    // ---- File --------------------------------------------------------------
    {
      id: 'newFile',
      label: 'cmd.newFile',
      shortcut: 'Ctrl+N',
      bindGlobal: true,
      run: () => void ops.newFile()
    },
    {
      id: 'openFile',
      label: 'cmd.openFile',
      shortcut: 'Ctrl+O',
      bindGlobal: true,
      run: () => void ops.openFile()
    },
    {
      id: 'openFolder',
      label: 'cmd.openFolder',
      shortcut: 'Ctrl+Shift+O',
      bindGlobal: true,
      run: () => void ops.openFolder()
    },
    {
      id: 'quickOpen',
      label: 'cmd.quickOpen',
      shortcut: 'Ctrl+P',
      bindGlobal: true,
      run: () => ops.openQuickOpen()
    },
    {
      id: 'saveFile',
      label: 'cmd.saveFile',
      shortcut: 'Ctrl+S',
      bindGlobal: true,
      run: () => void ops.saveFile()
    },
    {
      id: 'saveFileAs',
      label: 'cmd.saveFileAs',
      shortcut: 'Ctrl+Shift+S',
      bindGlobal: true,
      run: () => void ops.saveFileAs()
    },
    {
      id: 'openPreferences',
      label: 'cmd.openPreferences',
      shortcut: 'Ctrl+,',
      bindGlobal: true,
      run: () => ops.openPreferences()
    },
    {
      id: 'exportPdf',
      label: 'cmd.exportPdf',
      run: () => ops.exportDocument('pdf')
    },
    {
      id: 'exportHtml',
      label: 'cmd.exportHtml',
      run: () => ops.exportDocument('html')
    },
    // ---- Help --------------------------------------------------------------
    {
      id: 'showHelp',
      label: 'cmd.showHelp',
      run: () => ops.loadContent(getHelpMd(getLang()), null)
    }
  ]
}
