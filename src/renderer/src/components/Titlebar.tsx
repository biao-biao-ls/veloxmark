import MenuBar, { type MenuDef } from './MenuBar'
import { CloseIcon, MaximizeIcon, MinimizeIcon, MoonIcon, PanelIcon, SunIcon } from './Icons'
import type { ThemeName } from '../editor/theme'

interface Props {
  menus: MenuDef[]
  fileName: string
  dirty: boolean
  theme: ThemeName
  themeShortcut: string
  isMac: boolean
  onToggleOutline: () => void
  onToggleTheme: () => void
}

/**
 * Custom frameless titlebar (macOS keeps native traffic lights; the window
 * controls below still render there but are hidden via CSS platform rules).
 */
export default function Titlebar({
  menus,
  fileName,
  dirty,
  theme,
  themeShortcut,
  isMac,
  onToggleOutline,
  onToggleTheme
}: Props): React.JSX.Element {
  return (
    <div
      className="titlebar"
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('button') || target.closest('.menubar')) return
        window.api.windowMaximizeRestore()
      }}
    >
      <img className="tb-logo" src="/icon.png" alt="VeloxMark" draggable={false} />
      <MenuBar menus={menus} />
      <span className="tb-title">
        {dirty && <span className="tb-dirty">• </span>}
        {fileName} — VeloxMark
      </span>
      <span className="tb-spacer" />
      <button className="tb-btn" onClick={onToggleOutline} title="Toggle outline">
        <PanelIcon />
      </button>
      <button className="tb-btn" onClick={onToggleTheme} title={`Toggle theme (${themeShortcut})`}>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
      {!isMac && (
        <div className="window-controls">
          <button className="wc-btn" onClick={() => window.api.windowMinimize()} title="Minimize">
            <MinimizeIcon />
          </button>
          <button
            className="wc-btn"
            onClick={() => window.api.windowMaximizeRestore()}
            title="Maximize / Restore"
          >
            <MaximizeIcon />
          </button>
          <button className="wc-btn wc-close" onClick={() => window.api.windowClose()} title="Close">
            <CloseIcon />
          </button>
        </div>
      )}
    </div>
  )
}
