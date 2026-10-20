import { dialog } from '../components/Dialog'
import { t } from '../i18n'
import { showSaveDialog } from '../export/e2eSaveDialog'
import { baseNameOf } from '../pathUtil'
import { displayTabName, type DocTab } from './docTabs'

export interface SaveAllResult {
  ok: boolean
  failedPath: string | null
  error: unknown
}

export async function resolveTabCloseDirty(
  tab: DocTab,
  content: string,
  deps: { notifySaveFailed: (path: string | null, err: unknown) => void }
): Promise<boolean> {
  const choice = await dialog.choose({
    title: t('dialog.unsavedTitle'),
    message: t('tabs.closeDirty', { name: displayTabName(tab) }),
    confirmLabel: t('dialog.save'),
    discardLabel: t('dialog.dontSave'),
    cancelLabel: t('dialog.cancel')
  })
  if (choice === 'cancel') return false
  if (choice === 'confirm') {
    if (tab.path) {
      try {
        await window.api.writeFile(tab.path, content)
      } catch (err) {
        deps.notifySaveFailed(tab.path, err)
        return false
      }
      void window.api.draftDiscard(tab.path)
    } else {
      const target = await showSaveDialog('untitled.md')
      if (!target) return false
      try {
        await window.api.writeFile(target, content)
      } catch (err) {
        deps.notifySaveFailed(target, err)
        return false
      }
      tab.path = target
      tab.name = baseNameOf(target)
      tab.isWelcome = false
      void window.api.draftDiscard(null, tab.draftSlot)
    }
  } else {
    void window.api.draftDiscard(tab.path, tab.draftSlot)
  }
  return true
}

export async function confirmDiscard(deps: {
  isDirty: () => boolean
  getFilePath: () => string | null
  getDraftSlot: () => string | undefined
  saveFile: () => Promise<boolean>
}): Promise<boolean> {
  if (!deps.isDirty()) return true
  const choice = await dialog.choose({
    title: t('dialog.unsavedTitle'),
    message: t('dialog.unsavedSwitch'),
    confirmLabel: t('dialog.save'),
    discardLabel: t('dialog.dontSave'),
    cancelLabel: t('dialog.cancel')
  })
  if (choice === 'cancel') return false
  if (choice === 'discard') {
    void window.api.draftDiscard(deps.getFilePath(), deps.getDraftSlot())
    return true
  }
  return deps.saveFile()
}

export async function queryClose(deps: {
  allTabs: () => DocTab[]
  isTabDirty: (tab: DocTab) => boolean
  saveAllDirtyTabs: (options?: { interactive?: boolean }) => Promise<SaveAllResult>
}): Promise<boolean> {
  const dirtyTabs: DocTab[] = []
  for (const tab of deps.allTabs()) {
    if (deps.isTabDirty(tab)) dirtyTabs.push(tab)
  }
  if (dirtyTabs.length === 0) return true
  let message =
    dirtyTabs.length === 1
      ? t('dialog.unsavedCloseNamed', { name: displayTabName(dirtyTabs[0]) })
      : t('dialog.unsavedClose')
  if (dirtyTabs.length > 1) {
    const names = dirtyTabs.slice(0, 8).map((tb) => `· ${displayTabName(tb)}`)
    const more = dirtyTabs.length > 8 ? `\n… +${dirtyTabs.length - 8}` : ''
    message = `${t('dialog.unsavedCloseMulti', { n: dirtyTabs.length })}\n${names.join('\n')}${more}`
  }
  const choice = await dialog.choose({
    title: t('dialog.unsavedTitle'),
    message,
    confirmLabel: t('dialog.save'),
    discardLabel: t('dialog.dontSave'),
    cancelLabel: t('dialog.cancel')
  })
  if (choice === 'cancel') return false
  if (choice === 'discard') {
    for (const tb of dirtyTabs) void window.api.draftDiscard(tb.path, tb.draftSlot)
    return true
  }
  await deps.saveAllDirtyTabs({ interactive: true })
  const stillDirty = dirtyTabs.some((tb) => deps.isTabDirty(tb))
  return !stillDirty
}
