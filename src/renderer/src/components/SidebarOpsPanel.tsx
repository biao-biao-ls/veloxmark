/**
 * 6D「操作」面板（`temp/typora/typora-4.png`）：底部操作栏触发的下拉浮层，
 * 顶部标题「操作」+ ⊗ 关闭，五操作项；6E 排序行（分组 toggle + 四键互斥单选，
 * 点按选中/再按翻转升降）插在同一容器五项之后。开合经模块单例 bus
 * （`sidebarOpsBus`）——面板自身持开合态；Esc / 外点 / resize / ⊗ 关闭
 * （TreeMenu 同交互面）。6F「最近使用的目录」段后续插入同一容器。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { registerSidebarOps } from './sidebarOpsBus'
import { ClockIcon, CloseIcon, FileIcon, FolderIcon } from './Icons'
import { t } from '../i18n'
import { pressSortKey, toggleGroupFolders, type TreeSortKey } from '../filetree/sort'
import { setPreferences } from '../preferences/store'
import { usePreferences } from '../preferences/useStore'

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
  // 6E: sort state reacts via the preferences store (instant re-sort in the
  // tree; persisted across restarts — AC1/AC6).
  const sort = usePreferences().fileTreeSort

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

  // 6E: sort row glyphs per typora-4.png 排序行（↑A / ↑🕐 / ↑📄，方向箭头随 dir 翻转）。
  const dirArrow = sort.dir === 'asc' ? '↑' : '↓'
  const sortKeys: Array<{
    key: TreeSortKey
    op: string
    labelKey: string
    glyph: React.JSX.Element | string
  }> = [
    { key: 'natural', op: 'sidebar.ops.sort.natural', labelKey: 'ops.sort.natural', glyph: '123' },
    { key: 'name', op: 'sidebar.ops.sort.name', labelKey: 'ops.sort.name', glyph: 'A' },
    {
      key: 'mtime',
      op: 'sidebar.ops.sort.mtime',
      labelKey: 'ops.sort.mtime',
      glyph: <ClockIcon size={12} />
    },
    {
      key: 'birthtime',
      op: 'sidebar.ops.sort.birthtime',
      labelKey: 'ops.sort.birthtime',
      glyph: <FileIcon size={12} />
    }
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
      {/* 6E sort row — toggles, not actions: clicks must NOT close the panel. */}
      <div className="sidebar-ops-sort" role="group" aria-label={t('ops.sort')}>
        <span className="sidebar-ops-sort-label">{t('ops.sort')}</span>
        <button
          type="button"
          className={`sidebar-ops-sort-btn${sort.groupFolders ? ' is-active' : ''}`}
          data-op="sidebar.ops.sort.groupFolders"
          aria-pressed={sort.groupFolders}
          aria-label={t('ops.sort.groupFolders')}
          title={t('ops.sort.groupFolders')}
          onClick={() => setPreferences({ fileTreeSort: toggleGroupFolders(sort) })}
        >
          <FolderIcon size={13} />
        </button>
        {sortKeys.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar-ops-sort-btn${sort.key === item.key ? ' is-active' : ''}`}
            data-op={item.op}
            aria-pressed={sort.key === item.key}
            aria-label={t(item.labelKey)}
            title={t(item.labelKey)}
            onClick={() => setPreferences({ fileTreeSort: pressSortKey(sort, item.key) })}
          >
            <span className="sidebar-ops-sort-dir">{dirArrow}</span>
            {typeof item.glyph === 'string' ? (
              <span className="sidebar-ops-sort-glyph">{item.glyph}</span>
            ) : (
              item.glyph
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
