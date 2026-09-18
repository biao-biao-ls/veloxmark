import MenuBar, { type MenuDef } from './MenuBar'
import { CloseIcon, MaximizeIcon, MinimizeIcon, MoonIcon, PanelIcon, SearchIcon, SunIcon } from './Icons'
import type { ThemeName } from '../editor/theme'

interface Props {
  menus: MenuDef[]
  fileName: string
  dirty: boolean
  theme: ThemeName
  toggleOutline: () => void
  toggleTheme: () => void
  formatShortcut: (shortcut: string) => string
  /** P12: ms timestamp of the last autosave/draft-save; null = none yet. */
  autoSaveAt?: number | null
  /** P13: open the sidebar folder-search view (Ctrl+Shift+F). */
  openSearch?: () => void
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
  formatShortcut,
  autoSaveAt,
  openSearch
}: Props): React.JSX.Element {
  const autoSaveLabel =
    autoSaveAt != null
      ? `Auto-saved ${new Date(autoSaveAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })}`
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
      <img className="tb-logo" src="/icon.png" alt="VeloxMark" draggable={false} />
      <MenuBar menus={menus} />
      <span className="tb-title">
        {dirty && <span className="tb-dirty">• </span>}
        {fileName} — VeloxMark
        {autoSaveLabel && <span className="tb-autosave"> {autoSaveLabel}</span>}
      </span>
      <span className="tb-spacer" />
      <button
        className="tb-btn"
        onClick={openSearch}
        title="Search in folder (Ctrl+Shift+F)"
      >
        <SearchIcon />
      </button>
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
