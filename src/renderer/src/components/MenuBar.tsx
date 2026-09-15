import { useEffect, useRef, useState } from 'react'

export interface MenuItem {
  label?: string
  shortcut?: string
  action?: () => void
  separator?: boolean
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
                ) : (
                  <button
                    key={j}
                    className="menu-item"
                    onClick={() => {
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
