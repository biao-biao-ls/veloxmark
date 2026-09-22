import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { t } from '../i18n'

export interface TreeMenuItem {
  label: string
  danger?: boolean
  action: () => void
}

interface Props {
  x: number
  y: number
  items: TreeMenuItem[]
  onClose: () => void
}

/**
 * Minimal themed context menu for the folder file tree. Anchored at the
 * cursor, flipped into the viewport when it would overflow, and dismissed by
 * any outside click, Escape, or window resize.
 */
export default function TreeMenu({ x, y, items, onClose }: Props): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ x, y })

  // Flip near the right/bottom edge so the menu stays on screen.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      x: Math.min(x, window.innerWidth - width - 8),
      y: Math.min(y, window.innerHeight - height - 8)
    })
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="tree-menu"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.label}
          className={`tree-menu-item${item.danger ? ' tree-menu-danger' : ''}`}
          role="menuitem"
          onClick={() => {
            onClose()
            item.action()
          }}
        >
          {t(item.label)}
        </button>
      ))}
    </div>
  )
}
