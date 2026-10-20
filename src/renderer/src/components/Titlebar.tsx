import MenuBar, { type MenuDef } from './MenuBar'
import { CloseIcon, MaximizeIcon, MinimizeIcon } from './Icons'
import { t } from '../i18n'

interface Props {
  menus: MenuDef[]
  fileName: string
  dirty: boolean
  autoSaveAt?: number | null
  autoSaveError?: string | null
  hideSavedAt?: boolean
}

export default function Titlebar({
  menus,
  fileName,
  dirty,
  autoSaveAt,
  autoSaveError,
  hideSavedAt
}: Props): React.JSX.Element {
  const autoSaveLabel =
    autoSaveError != null
      ? autoSaveError
      : hideSavedAt
        ? null
        : autoSaveAt != null
          ? t('tb.autoSaved', {
              time: new Date(autoSaveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            })
          : null
  return (
    <div
      className="titlebar"
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('button') || target.closest('.menubar')) return
        window.api.windowMaximizeRestore()
      }}
    >
      <MenuBar menus={menus} />
      <span className="tb-title">
        {dirty && <span className="tb-dirty">• </span>}
        {fileName} — VeloxMark
        {autoSaveLabel && (
          <span className={autoSaveError != null ? 'tb-autosave tb-autosave-error' : 'tb-autosave'}>
            {' '}
            {autoSaveLabel}
          </span>
        )}
      </span>
      <span className="tb-spacer" />
      <div className="window-controls">
        <button className="wc-btn" onClick={() => window.api.windowMinimize()} title={t('tb.minimize')}>
          <MinimizeIcon />
        </button>
        <button
          className="wc-btn"
          onClick={() => window.api.windowMaximizeRestore()}
          title={t('tb.maximize')}
        >
          <MaximizeIcon />
        </button>
        <button
          className="wc-btn wc-close"
          onClick={() => window.api.windowClose()}
          title={t('tb.close')}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
