/**
 * P12 e2e seam — close-intercept / draft-recovery handle (task 1A split).
 *
 * Verbatim move of the `window.__veloxP12` literal out of the P12 effect in
 * App.tsx. That effect mixes this handle with the product's `onQueryClose`
 * window-close subscription, so the effect itself stays in App and only the
 * handle assembly moves here (`installP12Handle`). `lastAutoSaveAtRef` is
 * synced in App next to the autosave hook and passed in — this installer is a
 * plain function (not a hook), so the ref cannot migrate with it.
 * Contract: e2e/handles.d.ts `__veloxP12`.
 */
import type { RefObject } from 'react'
import type { FileOps, FilePathRef } from './types'

export interface P12Deps {
  queryClose: () => Promise<boolean>
  fileOps: FileOps
  filePathRef: FilePathRef
  checkDrafts: () => Promise<void>
  /** Synced from `autoSave.lastAutoSaveAt` in App (see header). */
  lastAutoSaveAtRef: RefObject<number | null>
}

export function installP12Handle(deps: P12Deps): void {
  const { queryClose, fileOps, filePathRef, checkDrafts, lastAutoSaveAtRef } = deps
  window.__veloxP12 = {
    queryClose: () => queryClose(),
    confirmDiscard: () => fileOps.confirmDiscard(),
    saveFile: () => fileOps.saveFile(),
    loadDoc: (content, path) => fileOps.loadContent(content, path),
    getFilePath: () => filePathRef.current,
    getDirty: () => fileOps.dirtyRef.current,
    draftList: () => window.api.draftList(),
    draftWrite: (path, content) => window.api.draftWrite(path, content),
    draftDiscard: (path) => window.api.draftDiscard(path),
    runDraftCheck: () => checkDrafts(),
    getLastAutoSaveAt: () => lastAutoSaveAtRef.current
  }
}
