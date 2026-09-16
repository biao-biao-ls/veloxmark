import MenuBar, { type MenuDef } from './MenuBar'
import { CloseIcon, MaximizeIcon, MinimizeIcon, MoonIcon, PanelIcon, SunIcon } from './Icons'
import type { ThemeName } from '../editor/theme'

interface Props {
  menus: MenuDef[]
  fileName: string
  dirty: boolean
  theme: ThemeName
  toggleOutline: () => void
  toggleTheme: () => void
  formatShortcut: (shortcut: string) => string
}

/**
 * Custom frameless titlebar: logo, in-app menu, document title, sidebar/theme
 * toggles and (Windows/Linux) window controls. macOS keeps native traffic
 * lights — the window controls are hidden there via CSS.
 */
export default function Titlebar({
  menus,
  fileName,
  dirty,
  theme,
  toggleOutline,
  toggleTheme,
  formatShortcut
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
      <button className="tb-btn" onClick={toggleOutline} title="Toggle outline">
        <PanelIcon />
      </button>
      <button
        className="tb-btn"
        onClick={toggleTheme}
        title={`Toggle theme (${formatShortcut('Ctrl+Shift+T')})`}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
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
        <button
          className="wc-btn wc-close"
          onClick={() => window.api.windowClose()}
          title="Close"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
