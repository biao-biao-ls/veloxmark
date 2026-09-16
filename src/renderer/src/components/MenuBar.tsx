import { useEffect, useRef, useState } from 'react'

export interface MenuItem {
  label?: string
  shortcut?: string
  /** Full-path tooltip (used by Open Recent entries). */
  title?: string
  action?: () => void
  separator?: boolean
  disabled?: boolean
  /** Second-level menu (e.g. File > Open Recent); shown on hover. */
  submenu?: MenuItem[]
}

export interface MenuDef {
  label: string
  items: MenuItem[]
}

interface Props {
  menus: MenuDef[]
}

export default function MenuBar({ menus }: Props): React.JSX.Element {
  const [open, setOpen] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (open === null) return
    const onDown = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="menubar" ref={rootRef}>
      {menus.map((menu, i) => (
        <div key={menu.label} className="menubar-root">
          <button
            className={`menubar-label${open === i ? ' menubar-open' : ''}`}
            onClick={() => setOpen(open === i ? null : i)}
            onMouseEnter={() => {
              // classic behavior: hovering another top-level menu keeps one open
              if (open !== null) setOpen(i)
            }}
          >
            {menu.label}
          </button>
          {open === i && (
            <div className="menu-dropdown">
              {menu.items.map((item, j) =>
                item.separator ? (
                  <div key={j} className="menu-separator" />
                ) : item.submenu ? (
                  <SubMenuHost key={j} item={item} onPick={() => setOpen(null)} />
                ) : (
                  <button
                    key={j}
                    className="menu-item"
                    title={item.title}
                    disabled={item.disabled}
                    onClick={() => {
                      if (item.disabled) return
                      setOpen(null)
                      item.action?.()
                    }}
                  >
                    <span className="menu-item-label">{item.label}</span>
                    {item.shortcut && (
                      <span className="menu-item-shortcut">{item.shortcut}</span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** An item that owns a second-level dropdown, revealed on hover. */
function SubMenuHost({
  item,
  onPick
}: {
  item: MenuItem
  onPick: () => void
}): React.JSX.Element {
  return (
    <div className="menu-sub-host">
      <button className="menu-item" disabled={item.disabled}>
        <span className="menu-item-label">{item.label}</span>
        <span className="menu-item-shortcut">▸</span>
      </button>
      <div className="menu-dropdown menu-sub">
        {item.submenu?.map((child, k) =>
          child.separator ? (
            <div key={k} className="menu-separator" />
          ) : (
            <button
              key={k}
              className="menu-item"
              title={child.title}
              disabled={child.disabled}
              onClick={() => {
                if (child.disabled) return
                onPick()
                child.action?.()
              }}
            >
              <span className="menu-item-label">{child.label}</span>
              {child.shortcut && (
                <span className="menu-item-shortcut">{child.shortcut}</span>
              )}
            </button>
          )
        )}
      </div>
    </div>
  )
}
