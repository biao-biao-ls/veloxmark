import { useEffect, useRef, useState } from 'react'
import type { DocTabInfo } from '../hooks/useFileOps'
import { t } from '../i18n'

export interface TabsBarProps {
  tabs: DocTabInfo[]
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onCloseOthers: (id: string) => void
  onCloseRight: (id: string) => void
  onReorder: (dragId: string, targetId: string) => void
}

interface MenuState {
  x: number
  y: number
  id: string
}

/**
 * P26 document tab bar: file name + dirty dot + close button per tab,
 * horizontal overflow scroll, middle-click close, context menu
 * (Close / Close Others / Close to the Right) and drag reorder.
 */
export function TabsBar({
  tabs,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseRight,
  onReorder
}: TabsBarProps): React.JSX.Element {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    document.addEventListener('click', close)
    document.addEventListener('contextmenu', close)
    return () => {
      document.removeEventListener('click', close)
      document.removeEventListener('contextmenu', close)
    }
  }, [menu])

  return (
    <div className="tabs-bar" ref={barRef} role="tablist">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tab"
          aria-selected={tab.active}
          className={`tab-item${tab.active ? ' is-active' : ''}`}
          title={tab.path ?? tab.name}
          draggable
          onDragStart={(e) => {
            dragIdRef.current = tab.id
            e.dataTransfer.effectAllowed = 'move'
            // Firefox needs data present for a drag to start.
            e.dataTransfer.setData('text/plain', tab.id)
          }}
          onDragOver={(e) => {
            if (dragIdRef.current && dragIdRef.current !== tab.id) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            const dragId = dragIdRef.current
            dragIdRef.current = null
            if (dragId && dragId !== tab.id) onReorder(dragId, tab.id)
          }}
          onMouseDown={(e) => {
            // Middle-click closes (button 1); button 0 activates.
            if (e.button === 1) {
              e.preventDefault()
              onClose(tab.id)
            } else if (e.button === 0) {
              onActivate(tab.id)
            }
          }}
          onAuxClick={(e) => {
            if (e.button === 1) {
              e.preventDefault()
              onClose(tab.id)
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setMenu({ x: e.clientX, y: e.clientY, id: tab.id })
          }}
        >
          {tab.dirty && <span className="tab-dirty-dot" aria-label="dirty" />}
          <span className="tab-name">{tab.name}</span>
          <button
            type="button"
            className="tab-close"
            title={t('tabs.close')}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onClose(tab.id)
            }}
          >
            ×
          </button>
        </div>
      ))}
      {menu && (
        <div className="tab-context-menu" style={{ left: menu.x, top: menu.y }}>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              setMenu(null)
              onClose(menu.id)
            }}
          >
            {t('tabs.close')}
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              setMenu(null)
              onCloseOthers(menu.id)
            }}
          >
            {t('tabs.closeOthers')}
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              setMenu(null)
              onCloseRight(menu.id)
            }}
          >
            {t('tabs.closeRight')}
          </button>
        </div>
      )}
    </div>
  )
}
