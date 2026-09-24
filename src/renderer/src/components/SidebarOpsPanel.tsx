/**
 * 6D「操作」面板（`temp/typora/typora-4.png`）：底部操作栏触发的下拉浮层，
 * 顶部标题「操作」+ ⊗ 关闭，五操作项。开合经模块单例 bus（`sidebarOpsBus`）——
 * 面板自身持开合态；Esc / 外点 / resize / ⊗ 关闭（TreeMenu 同交互面）。
 * 6E 排序行、6F「最近使用的目录」段后续插入同一容器，本单元只搭容器与五项。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { registerSidebarOps } from './sidebarOpsBus'
import { CloseIcon } from './Icons'
import { t } from '../i18n'

export interface SidebarOpsActions {
  onNewFile: () => void
  onSearch: () => void
  onReveal: () => void
  onOpenFolder: () => void
  onRefresh: () => void
}

export default function SidebarOpsPanel(actions: SidebarOpsActions): React.JSX.Element | null {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ left: 0, bottom: 0 })

  // Singleton registration: trigger presses toggle (open with this anchor /
  // close when already open — the AC3 two-entry, one-panel rule).
  useEffect(() => {
    registerSidebarOps((rect) => setAnchor((cur) => (cur ? null : rect)))
    return () => registerSidebarOps(null)
  }, [])

  // Flip horizontally near the window edge; always opens upward from the
  // trigger (bottom-bar buttons sit at the sidebar's bottom edge).
  useLayoutEffect(() => {
    if (!anchor) return
    const width = ref.current?.getBoundingClientRect().width ?? 180
    setPos({
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
      bottom: Math.max(8, window.innerHeight - anchor.top + 4)
    })
  }, [anchor])

  useEffect(() => {
    if (!anchor) return
    const close = (): void => setAnchor(null)
    const onDown = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      // Trigger mousedown must not dismiss — the trigger click's toggle would
      // see a closed panel and just reopen it (unclosable via the trigger).
      if (target.closest?.('[data-op="sidebar.ops.open"]')) return
      if (!ref.current?.contains(target)) close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [anchor])

  if (!anchor) return null

  // Label keys reuse exact-copy entries where they exist (i18n 纪律：不造重复 key).
  const items: Array<{ op: string; labelKey: string; run: () => void }> = [
    { op: 'sidebar.ops.newFile', labelKey: 'app.newFile', run: actions.onNewFile },
    { op: 'sidebar.ops.search', labelKey: 'ops.search', run: actions.onSearch },
    { op: 'sidebar.ops.reveal', labelKey: 'ops.reveal', run: actions.onReveal },
    { op: 'sidebar.ops.openFolder', labelKey: 'cmd.openFolder', run: actions.onOpenFolder },
    { op: 'sidebar.ops.refresh', labelKey: 'ops.refresh', run: actions.onRefresh }
  ]

  return (
    <div
      ref={ref}
      className="sidebar-ops"
      style={{ left: pos.left, bottom: pos.bottom }}
      role="menu"
      aria-label={t('ops.title')}
    >
      <div className="sidebar-ops-header">
        <span>{t('ops.title')}</span>
        <button
          type="button"
          className="sidebar-ops-close"
          data-op="sidebar.ops.close"
          aria-label={t('mermaidPreview.close')}
          onClick={() => setAnchor(null)}
        >
          <CloseIcon size={12} />
        </button>
      </div>
      {items.map((item) => (
        <button
          key={item.op}
          type="button"
          className="sidebar-ops-item"
          role="menuitem"
          data-op={item.op}
          onClick={() => {
            setAnchor(null)
            item.run()
          }}
        >
          {t(item.labelKey)}
        </button>
      ))}
    </div>
  )
}
