import { t } from '../i18n'
import { CloseIcon } from './Icons'

export type DialogLights = 'full' | 'close-only'

interface Props {
  title: string
  onClose: () => void
  lights?: DialogLights
  closeRef?: React.Ref<HTMLButtonElement>
  closeDisabled?: boolean
}

export default function DialogTitleBar({
  title,
  onClose,
  lights = 'full',
  closeRef,
  closeDisabled
}: Props): React.JSX.Element {
  const isMac = window.api.platform === 'darwin'
  const stopConfirmKeys = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
  }
  const closeBtnAttrs = {
    ref: closeRef,
    'data-testid': 'dialog-titlebar-close',
    'aria-label': t('dialog.close'),
    onClick: onClose,
    disabled: closeDisabled,
    onKeyDown: stopConfirmKeys
  }
  return isMac ? (
    <div className="dialog-titlebar dialog-titlebar-mac" data-testid="dialog-titlebar">
      <div className="dt-lights">
        <button type="button" className="dt-light dt-light-close" {...closeBtnAttrs} />
        {lights === 'full' && (
          <>
            <span className="dt-light dt-light-min" aria-hidden="true" />
            <span className="dt-light dt-light-zoom" aria-hidden="true" />
          </>
        )}
      </div>
      <div className="dt-title">{title}</div>
    </div>
  ) : (
    <div className="dialog-titlebar dialog-titlebar-win" data-testid="dialog-titlebar">
      <div className="dt-title">{title}</div>
      <button type="button" className="wc-btn wc-close dt-caption-close" {...closeBtnAttrs}>
        <CloseIcon />
      </button>
    </div>
  )
}
