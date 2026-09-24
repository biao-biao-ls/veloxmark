/**
 * 6D「操作」面板（`temp/typora/typora-4.png`）：底部操作栏触发的下拉浮层，
 * 顶部标题「操作」+ ⊗ 关闭，五操作项；6E 排序行（分组 toggle + 四键互斥单选，
 * 点按选中/再按翻转升降）；6F「最近使用的目录」段（点击走 6B 显式根通道切根、
 * 当前根蓝点、hover 置顶 toggle / 移除）同插一容器。开合经模块单例 bus
 * （`sidebarOpsBus`）——面板自身持开合态；Esc / 外点 / resize / ⊗ 关闭
 * （TreeMenu 同交互面）。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { registerSidebarOps } from './sidebarOpsBus'
import { ClockIcon, CloseIcon, FileIcon, FolderIcon, PinIcon, TrashIcon } from './Icons'
import { t } from '../i18n'
import { pressSortKey, toggleGroupFolders, type TreeSortKey } from '../filetree/sort'
import {
  pathKey,
  recentDisplayName,
  removeRecent,
  togglePinRecent,
  visibleRecents
} from '../filetree/recents'
import { setPreferences } from '../preferences/store'
import { usePreferences } from '../preferences/useStore'

export interface SidebarOpsActions {
  onNewFile: () => void
  onSearch: () => void
  onReveal: () => void
  onOpenFolder: () => void
  onRefresh: () => void
  /** 6F AC1: recents row click — explicit-root jump (loadFolder channel). */
  onOpenRecent: (path: string) => void
  /** 6F D4: resolved tree root — marks the current-folder row (blue dot). */
  currentRoot: string | null
}

export default function SidebarOpsPanel(actions: SidebarOpsActions): React.JSX.Element | null {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ left: 0, bottom: 0 })
  // 6E/6F: sort + recents state react via the preferences store (instant
  // re-sort / list refresh; persisted across restarts).
  const prefs = usePreferences()
  const sort = prefs.fileTreeSort

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
      {/* 6F「最近使用的目录」段（typora-4.png 面板底部）：行点击切根（关面板），
          置顶 toggle / 移除为行内操作（不关面板，同排序行 toggle 语义）。 */}
      {(() => {
        const recents = visibleRecents(prefs.recentFolders)
        if (recents.length === 0) return null
        const rootKey = actions.currentRoot ? pathKey(actions.currentRoot) : null
        return (
          <div className="sidebar-ops-recents" role="group" aria-label={t('ops.recents')}>
            <div className="sidebar-ops-recents-title">{t('ops.recents')}</div>
            {recents.map((entry) => {
              const isCurrent = rootKey !== null && pathKey(entry.path) === rootKey
              return (
                <div
                  key={entry.path}
                  className="sidebar-ops-recent"
                  data-op="sidebar.ops.recent.item"
                  data-path={entry.path}
                >
                  <button
                    type="button"
                    className="sidebar-ops-recent-main"
                    data-op="sidebar.ops.recent.open"
                    title={entry.path}
                    onClick={() => {
                      setAnchor(null)
                      actions.onOpenRecent(entry.path)
                    }}
                  >
                    <FolderIcon size={13} />
                    <span className="sidebar-ops-recent-name">{recentDisplayName(entry.path)}</span>
                  </button>
                  {isCurrent ? (
                    <span className="recents-current" aria-label={t('ops.recents.current')} />
                  ) : null}
                  <button
                    type="button"
                    className={`sidebar-ops-recent-act${entry.pinned ? ' is-active' : ''}`}
                    data-op="sidebar.ops.recent.pin"
                    aria-pressed={!!entry.pinned}
                    aria-label={entry.pinned ? t('ops.recents.unpin') : t('ops.recents.pin')}
                    title={entry.pinned ? t('ops.recents.unpin') : t('ops.recents.pin')}
                    onClick={() =>
                      setPreferences({ recentFolders: togglePinRecent(prefs.recentFolders, entry.path) })
                    }
                  >
                    <PinIcon size={12} />
                  </button>
                  <button
                    type="button"
                    className="sidebar-ops-recent-act"
                    data-op="sidebar.ops.recent.remove"
                    aria-label={t('ops.recents.remove')}
                    title={t('ops.recents.remove')}
                    onClick={() =>
                      setPreferences({ recentFolders: removeRecent(prefs.recentFolders, entry.path) })
                    }
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
