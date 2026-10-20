import { useEffect } from 'react'
import type { UpdaterStatus } from '../../../../electron/shared/api'
import { toast } from '../hooks/useToast'
import { t } from '../i18n'
import { dialog } from './Dialog'

const RELEASES_URL = 'https://github.com/biao-biao-ls/veloxmark/releases/latest'

async function handleStatus(status: UpdaterStatus): Promise<void> {
  switch (status.phase) {
    case 'checking':
      toast(t('update.checking'))
      return
    case 'not-available':
      toast(t('update.latest'))
      return
    case 'downloading':
      toast(t('update.downloading'))
      return
    case 'available': {
      const manual = status.mode === 'manual'
      const ok = await dialog.confirm({
        title: t('update.availableTitle'),
        message: t(manual ? 'update.availableManual' : 'update.availableAuto', {
          v: status.version ?? ''
        }),
        confirmLabel: t(manual ? 'update.openDownloadPage' : 'update.download')
      })
      if (!ok) return
      if (manual) void window.api.openExternal(RELEASES_URL)
      else void window.api.downloadUpdate()
      return
    }
    case 'downloaded': {
      const ok = await dialog.confirm({
        title: t('update.downloadedTitle'),
        message: t('update.downloadedMessage', { v: status.version ?? '' }),
        confirmLabel: t('update.restartNow'),
        cancelLabel: t('update.later')
      })
      if (ok) window.api.installUpdate()
      return
    }
    case 'error': {
      // Auto-update failed (e.g. unsigned mac build — Squirrel.Mac requires signing)
      // -> fall back to opening the releases page
      const ok = await dialog.confirm({
        title: t('update.errorTitle'),
        message: t('update.errorMessage'),
        confirmLabel: t('update.openDownloadPage')
      })
      if (ok) void window.api.openExternal(RELEASES_URL)
      return
    }
  }
}

/** Headless component: turns main-process updater status into toasts/dialogs (check/download/install confirmations) */
export default function UpdaterBridge(): null {
  useEffect(() => {
    return window.api.onUpdaterStatus((status) => {
      void handleStatus(status)
    })
  }, [])
  return null
}
