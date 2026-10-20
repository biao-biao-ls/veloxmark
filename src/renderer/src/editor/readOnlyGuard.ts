import { t } from '../i18n'
import { getCtxRuntime } from './contextMenu/registry'

export async function assertWritable(): Promise<boolean> {
  const path = getCtxRuntime()?.getActiveFilePath?.() ?? null
  if (!path) return true
  let writable: boolean
  try {
    writable = await window.api.isWritable(path)
  } catch {
    return true
  }
  if (writable) return true
  getCtxRuntime()?.toast(t('err.readonly'))
  return false
}
