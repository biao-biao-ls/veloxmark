/**
 * P12/P26 close policy (task 3.5) — the three-option dialog semantics for
 * dirty closes. Control-flow bodies moved verbatim from useFileOps.ts
 * (confirmDiscard / queryClose / closeTab's dirty branch); collaborators are
 * explicit deps so the policy layer stays free of hook/store imports.
 */
import { dialog } from '../components/Dialog'
import { t } from '../i18n'
import { showSaveDialog } from '../export/e2eSaveDialog'
import { baseNameOf } from '../pathUtil'
import type { DocTab } from './docTabs'

export interface SaveAllResult {
  ok: boolean
  failedPath: string | null
  error: unknown
}

/**
 * closeTab's dirty branch (P12 three-option gate + save-on-close semantics).
 * `content` is the tab's live content extracted by the caller. Returns true
 * when the close may proceed (saved or discarded), false when the user
 * cancelled or a save write failed (tab stays open + dirty). Mutates
 * `tab.path`/`tab.name` on the untitled-active Save As branch (kept verbatim
 * from the old inline branch).
 */
export async function resolveTabCloseDirty(
  tab: DocTab,
  content: string,
  isActive: boolean,
  deps: { notifySaveFailed: (path: string | null, err: unknown) => void }
): Promise<boolean> {
  const choice = await dialog.choose({
    title: t('dialog.unsavedTitle'),
    message: t('tabs.closeDirty', { name: tab.name }),
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
        // wave③: user asked to save-on-close — a failed write must not
        // close the tab; surface the cause and keep it open + dirty.
        deps.notifySaveFailed(tab.path, err)
        return false
      }
      void window.api.draftDiscard(tab.path)
    } else if (isActive) {
      // Untitled active tab needs a path before it can be "saved".
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
      void window.api.draftDiscard(null)
    } else {
      await window.api.draftWrite(null, content)
    }
  } else {
    void window.api.draftDiscard(tab.path)
  }
  return true
}

/**
 * P12 three-option gate before discarding dirty content. Post-P26 this
 * guards direct buffer-replacement paths and e2e; open flows go through
 * tabs instead. Message stays single-document (active tab).
 */
export async function confirmDiscard(deps: {
  isDirty: () => boolean
  getFilePath: () => string | null
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
    void window.api.draftDiscard(deps.getFilePath())
    return true
  }
  return deps.saveFile()
}

/**
 * P12/P26 close intercept — also reachable via window.__veloxP12 for CDP.
 * Multiple dirty tabs: the dialog message lists every dirty document
 * (list-confirm v1 — one decision applies to all; per-item buttons are a
 * documented non-goal for this batch). Returns whether main may close.
 */
export async function queryClose(deps: {
  allTabs: () => DocTab[]
  isTabDirty: (tab: DocTab) => boolean
  saveAllDirtyTabs: () => Promise<SaveAllResult>
}): Promise<boolean> {
  const dirtyTabs: DocTab[] = []
  for (const tab of deps.allTabs()) {
    if (deps.isTabDirty(tab)) dirtyTabs.push(tab)
  }
  if (dirtyTabs.length === 0) return true
  // UX-P12 F1 trust element: name the document in the single-dirty case —
  // a generic "Save changes before closing?" identifies nothing.
  let message =
    dirtyTabs.length === 1
      ? t('dialog.unsavedCloseNamed', { name: dirtyTabs[0].name })
      : t('dialog.unsavedClose')
  if (dirtyTabs.length > 1) {
    const names = dirtyTabs.slice(0, 8).map((tb) => `· ${tb.name}`)
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
    for (const tb of dirtyTabs) void window.api.draftDiscard(tb.path)
    return true
  }
  await deps.saveAllDirtyTabs()
  // A cancelled Save As on an untitled active tab keeps the window open.
  const stillDirty = dirtyTabs.some((tb) => deps.isTabDirty(tb))
  return !stillDirty
}
