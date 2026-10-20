import type { RefObject } from 'react'
import type { FileOps, FilePathRef } from './types'

export interface P12Deps {
  queryClose: () => Promise<boolean>
  fileOps: FileOps
  filePathRef: FilePathRef
  checkDrafts: () => Promise<void>
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
    draftWrite: (path, content, slot) => window.api.draftWrite(path, content, slot),
    draftDiscard: (path, slot) => window.api.draftDiscard(path, slot),
    runDraftCheck: () => checkDrafts(),
    getLastAutoSaveAt: () => lastAutoSaveAtRef.current
  }
}
