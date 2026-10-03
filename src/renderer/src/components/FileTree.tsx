import { useEffect, useMemo, useRef, useState } from 'react'
import type { DirNode } from '../../../../electron/shared/api'
import { FileMdIcon, FolderIcon, FolderOpenIcon } from './Icons'
import { t } from '../i18n'
import { ancestorDirPaths, flattenFiles, visibleRows, type FlatRow } from './filetreeRows'
import { resolveKey, toVisibleRows, type VisibleRow } from './filetreeKeys'
import { pathsEqual } from '../pathUtil'
import { sortTreeNodes } from '../filetree/sort'
import { usePreferences } from '../preferences/useStore'

/** node === null means the workspace root (empty-area context menu, P07). */
export interface TreeMenuRequest {
  x: number
  y: number
  node: DirNode | null
}

interface Props {
  nodes: DirNode[]
  activePath: string | null
  onOpen: (path: string) => void
  onContextMenu: (req: TreeMenuRequest) => void
  /** P07 drag-drop: move srcPath into destDir. */
  onMove: (srcPath: string, destDir: string) => void
  /** UX-P07-F4: node currently in inline-rename mode (post-create IDE flow). */
  renamingPath?: string | null
  onRenameCommit: (node: DirNode, name: string) => void
  onRenameCancel: () => void
  /** 6D D3: controlled row selection (new-file target; 6G menus reuse). */
  selectedPath?: string | null
  onSelect?: (path: string, isDir: boolean) => void
  /** 6G: pending inline-create target — renders the CreateRow input. */
  pendingCreate?: { parentPath: string; kind: 'file' | 'dir' } | null
  onCreateCommit: (name: string) => void
  onCreateCancel: () => void
}

// Fixed row height keeps the virtualization math exact. UI-IXD row height
// is 28px (ui_05 / FE-06#1). CSS twin: styles/tokens.css --tree-row-h —
// keep both in lockstep.
const ROW_HEIGHT = 28

/** Row indent rides CSS tokens (--tree-indent * (depth + 1), ui_05 16px/级)
 *  — pass the unitless depth, never a px literal (FE-10 audit). */
const depthStyle = (depth: number): React.CSSProperties =>
  ({ '--tree-depth': depth }) as React.CSSProperties

/**
 * Indent guides (FE-06#4): `depth` hairlines at each step's center
 * (`--tree-indent * i + --tree-indent / 2`, i in 0..depth-1) — matching the
 * ui_05 mock (depth-2 rows carry one guide at left 8px). Pure decoration,
 * absolutely positioned inside the row (row is position: relative).
 */
const indentGuides = (depth: number): React.ReactNode[] =>
  Array.from({ length: depth }, (_, i) => (
    <i
      key={`guide-${i}`}
      className="filetree-guide"
      style={{ left: `calc(var(--tree-indent) * ${i} + var(--tree-indent) / 2)` }}
    />
  ))
/** 6G render-list entry: a data row (with its keyRows index), or the spliced inline-create input. */
type ViewRow = (FlatRow & { relDir?: string; keyIndex: number }) | { create: 'file' | 'dir'; depth: number }
// Above this many visible rows, window the render (spacer divs, no abs pos).
const VIRTUALIZE_AT = 500
const OVERSCAN = 10
// FE-06: the nav-key set (nav-keyboard:file-tree) — consumed when a tree row
// holds focus so arrows/Home/End never rubber-band the panel scroll.
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'])

/** src of the in-flight drag; dragover can't read dataTransfer, so share it. */
let dragSrcPath: string | null = null

/**
 * Inline rename row (UX-P07-F4): appears after create, and any time the
 * workspace points renamingPath at a tree node. Enter/blur commits, Esc
 * cancels — the commit path reuses the hook's rename validation.
 */
function RenameRow({
  node,
  depth,
  virtualize,
  onCommit,
  onCancel
}: {
  node: DirNode
  depth: number
  virtualize: boolean
  onCommit: (node: DirNode, name: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    // IDE convention: select the basename, keep the extension editable away.
    const dot = node.name.lastIndexOf('.')
    el.setSelectionRange(0, dot > 0 ? dot : node.name.length)
  }, [node.name])

  const commit = (value: string): void => {
    if (doneRef.current) return
    doneRef.current = true
    onCommit(node, value.trim())
  }

  return (
    <div
      className={`filetree-item filetree-renaming${virtualize ? ' filetree-item-fixed' : ''}`}
      style={depthStyle(depth)}
      title={node.path}
    >
      {indentGuides(depth)}
      <span className="filetree-twisty empty">·</span>
      <input
        ref={inputRef}
        className="filetree-rename-input"
        defaultValue={node.name}
        aria-label={node.isDir ? t('tree.renameFolder') : t('tree.renameFile')}
        spellCheck={false}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            commit((e.target as HTMLInputElement).value)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            if (doneRef.current) return
            doneRef.current = true
            onCancel()
          }
        }}
        onBlur={(e) => commit(e.target.value)}
      />
    </div>
  )
}

/**
 * Inline create row (6G): an empty name input under the target parent — the
 * prompt-dialog replacement. Same `filetree-renaming` chrome as RenameRow
 * (AC5 visual/interaction parity): Enter/blur commits, Esc cancels.
 */
function CreateRow({
  kind,
  depth,
  virtualize,
  onCommit,
  onCancel
}: {
  kind: 'file' | 'dir'
  depth: number
  virtualize: boolean
  onCommit: (name: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const commit = (value: string): void => {
    if (doneRef.current) return
    doneRef.current = true
    onCommit(value.trim())
  }

  return (
    <div
      className={`filetree-item filetree-renaming${virtualize ? ' filetree-item-fixed' : ''}`}
      style={depthStyle(depth)}
    >
      {indentGuides(depth)}
      <span className="filetree-twisty empty">·</span>
      <input
        ref={inputRef}
        className="filetree-rename-input"
        defaultValue=""
        placeholder={t('tree.namePlaceholder')}
        aria-label={kind === 'dir' ? t('tree.newFolder') : t('tree.newFile')}
        spellCheck={false}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            commit((e.target as HTMLInputElement).value)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            if (doneRef.current) return
            doneRef.current = true
            onCancel()
          }
        }}
        onBlur={(e) => commit(e.target.value)}
      />
    </div>
  )
}

/**
 * Flat markdown file tree for the folder sidebar. Visible rows come from
 * `filetreeRows.visibleRows` (depth-first flatten of open nodes — 6C: default
 * collapsed, active-file ancestor chain revealed, rename chain forced open),
 * which makes large workspaces windowable: above VIRTUALIZE_AT rows only the
 * scroll viewport (+overscan) is rendered, using top/bottom spacer divs inside
 * the sidebar's own scroll. Clicking a folder label toggles it, clicking a
 * file opens it, right-clicking opens the tree context menu; files and
 * folders are draggable onto folder rows. Empty-area right-click (nav
 * surface) opens the workspace-root menu (UX-P07-F0).
 */
export default function FileTree({
  nodes,
  activePath,
  onOpen,
  onContextMenu,
  onMove,
  renamingPath,
  onRenameCommit,
  onRenameCancel,
  selectedPath,
  onSelect,
  pendingCreate,
  onCreateCommit,
  onCreateCancel
}: Props): React.JSX.Element {
  // 6C D1: untouched dirs are collapsed (no size heuristic); only explicit
  // user toggles live here — reveal-derived openness never writes this map.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)
  const treeRef = useRef<HTMLElement | null>(null)

  const sep = window.api.platform === 'win32' ? '\\' : '/'

  // 6C D2: strict-ancestor dirs of the active file are default-open (derived,
  // never written to `expanded`) so the active row is reachable; user collapse
  // still wins. Rename ancestors force open (UX-P07-F4).
  const revealDirs = useMemo(() => ancestorDirPaths(activePath), [activePath])
  // 6G: the create input's parent chain force-opens like a rename target —
  // fake-child path so the parent dir itself is in the chain (its row must be
  // visible: the input row is spliced right below it).
  const createDirs = useMemo(
    () => (pendingCreate ? ancestorDirPaths(pendingCreate.parentPath + sep + 'n') : null),
    [pendingCreate, sep]
  )
  const renameDirs = useMemo(() => {
    const dirs = ancestorDirPaths(renamingPath ?? null)
    if (createDirs) for (const d of createDirs) dirs.add(d)
    return dirs
  }, [renamingPath, createDirs])
  // 6E D4: sort is a pure pre-pass on the scan tree (per-level; shared with the
  // 6.12 list fork) — inserted before the 6C flatten seam. Reactive to the
  // ops-panel sort row via preferences (instant re-sort, spec AC1).
  const prefs = usePreferences()
  const fileTreeSort = prefs.fileTreeSort
  const fileTreeView = prefs.fileTreeView
  const sortedNodes = useMemo(() => sortTreeNodes(nodes, fileTreeSort), [nodes, fileTreeSort])
  // 6F D2: list view = all md files flattened with a relDir subtitle, globally
  // ordered by the shared 6E key (groupFolders is a no-op on files-only input).
  // Tree view keeps the 6C flatten. Both feed the same row renderer/virtualizer.
  const rows = useMemo(() => {
    if (fileTreeView === 'list') {
      const flat = flattenFiles(sortedNodes, sep)
      const relByPath = new Map(flat.map((r) => [r.node.path, r.relDir]))
      const sorted = sortTreeNodes(
        flat.map((r) => r.node),
        fileTreeSort
      )
      return sorted.map((node) => ({
        node,
        depth: 0,
        open: false,
        relDir: relByPath.get(node.path) ?? ''
      }))
    }
    return visibleRows(sortedNodes, { expanded, revealDirs, renameDirs })
  }, [fileTreeView, sortedNodes, fileTreeSort, sep, expanded, revealDirs, renameDirs])

  // FE-06 nav-keyboard:file-tree — keyboard model over data rows only (the
  // spliced create row is an input, not a navigation target). Index space is
  // `rows`; virtualization stays a render concern (focus scrolls into view).
  const keyRows = useMemo(() => toVisibleRows(rows), [rows])
  const [focusIndex, setFocusIndex] = useState(-1)
  // Keyboard-modality marker for the focus ring (nav-keyboard:focus-visible):
  // the ring is keyboard-only — nav keys set it, pointer clicks clear it.
  // Pairs with :focus-visible in CSS (same idiom as .search-match-focus).
  const [kbdNav, setKbdNav] = useState(false)
  // FE-06 r2 #11: active follows the open document row — separator-insensitive
  // (win scan `\` vs open-path `/`) so the highlight never misses or lags.
  const activeIdx = useMemo(
    () => keyRows.findIndex((r) => pathsEqual(r.path, activePath ?? '')),
    [keyRows, activePath]
  )
  // Roving tabindex stop: explicit focus wins, else the active file row, else
  // first row — so Tab can always enter the tree (AC-FN-13 keyboard path).
  const tabStop =
    focusIndex >= 0 && focusIndex < keyRows.length
      ? focusIndex
      : activeIdx >= 0
        ? activeIdx
        : keyRows.length > 0
          ? 0
          : -1
  // Focus target that still needs a DOM .focus() after re-render (virtualized
  // rows may not exist yet when the key was handled).
  const pendingFocusRef = useRef<number | null>(null)
  useEffect(() => {
    const idx = pendingFocusRef.current
    if (idx == null) return
    const el = treeRef.current?.querySelector<HTMLElement>(`[data-nav-index="${idx}"]`)
    if (!el) return // windowed out; re-runs after the scroll re-render
    pendingFocusRef.current = null
    el.focus()
  })

  // Minimal scroll-into-view for keyboard focus (the active-row reveal above
  // centers instead — different intent, kept separate on purpose).
  const scrollRowIntoView = (idx: number): void => {
    const side = treeRef.current?.closest('.sidebar')
    if (!side) return
    const treeTop = treeRef.current?.offsetTop ?? 0
    const rowTop = treeTop + idx * ROW_HEIGHT
    const rowBottom = rowTop + ROW_HEIGHT
    const viewTop = side.scrollTop
    const viewBottom = viewTop + side.clientHeight
    let next = viewTop
    if (rowTop < viewTop) next = rowTop
    else if (rowBottom > viewBottom) next = rowBottom - side.clientHeight
    else return
    const clamped = Math.max(0, next)
    side.scrollTop = clamped
    setScrollTop(clamped) // keep the virtual window in sync immediately
  }

  // FE-06: route nav keys through the pure mapper. Fires only when DOM focus
  // is on a tree row (the handler lives on the nav) — editor input is never
  // hijacked. Enter is preventDefault'd so the button's synthesized click
  // (which would double-open) is suppressed.
  const onTreeKeyDown = (e: React.KeyboardEvent): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-nav-index]')
    if (target && NAV_KEYS.has(e.key)) setKbdNav(true)
    const cur = target ? Number(target.dataset.navIndex) : tabStop
    const result = resolveKey({ rows: keyRows, focusIndex: cur }, e.key)
    if (result.action === 'none') {
      // Consume the nav key set inside a non-empty tree so arrows/Home/End
      // don't rubber-band the panel; unknown keys pass through untouched.
      if (keyRows.length > 0 && target && NAV_KEYS.has(e.key)) e.preventDefault()
      return
    }
    e.preventDefault()
    switch (result.action) {
      case 'move':
      case 'first':
      case 'last': {
        // Focus movement never opens files (Enter only) and never changes
        // the new-file target selection.
        pendingFocusRef.current = result.nextIndex
        setFocusIndex(result.nextIndex)
        scrollRowIntoView(result.nextIndex)
        break
      }
      case 'collapse':
      case 'expand': {
        const row = keyRows[cur]
        setExpanded((m) => ({ ...m, [row.path]: result.action === 'expand' }))
        break
      }
      case 'open': {
        // Enter mirrors the row click: select target, then open.
        const row = keyRows[cur]
        onSelect?.(row.path, false)
        onOpen(row.path)
        break
      }
    }
  }

  // 6G D3: splice the CreateRow into the render list — after the parent dir row
  // in tree mode (parent chain force-open above), index 0 when the parent is
  // the root itself, missing from the rows, or in list view. Part of the same
  // array as data rows so virtualization math stays exact.
  // keyIndex stays the index into `rows` (keyboard model) regardless of splice.
  const viewRows = useMemo((): ViewRow[] => {
    const base: ViewRow[] = rows.map((r, i) => ({ ...r, keyIndex: i }))
    if (!pendingCreate) return base
    let at = 0
    let depth = 0
    if (fileTreeView !== 'list') {
      const i = base.findIndex(
        (r) => 'node' in r && r.node.isDir && r.node.path === pendingCreate.parentPath
      )
      if (i >= 0) {
        at = i + 1
        depth = (base[i] as FlatRow).depth + 1
      }
    }
    base.splice(at, 0, { create: pendingCreate.kind, depth })
    return base
  }, [rows, pendingCreate, fileTreeView])

  // The sidebar is the scroll parent — track it so the window follows scroll.
  useEffect(() => {
    const side = treeRef.current?.closest('.sidebar')
    if (!side) return
    const onScroll = (): void => {
      setScrollTop(side.scrollTop)
      setViewportH(side.clientHeight)
    }
    side.addEventListener('scroll', onScroll, { passive: true })
    setViewportH(side.clientHeight)
    return () => side.removeEventListener('scroll', onScroll)
  }, [])

  // 6C D3/D5: reveal scroll — center the active row once it becomes visible
  // (tab switch, root change, or tree data arriving late). Re-scroll only when
  // the target path changes or first appears, so unrelated tree churn (e.g.
  // manual expand/collapse elsewhere) never jitters the viewport.
  const lastRevealRef = useRef<{ path: string | null; found: boolean }>({ path: null, found: false })
  useEffect(() => {
    const idx = viewRows.findIndex(
      (r) => 'node' in r && pathsEqual(r.node.path, activePath ?? '')
    )
    const found = idx >= 0
    const last = lastRevealRef.current
    if (found && last.path === activePath && last.found) return
    lastRevealRef.current = { path: activePath, found }
    if (!found) return
    const side = treeRef.current?.closest('.sidebar')
    if (!side) return
    // row i sits at treeTop + i*ROW_H inside the sidebar's scroll space.
    const treeTop = treeRef.current?.offsetTop ?? 0
    const rowTop = treeTop + idx * ROW_HEIGHT
    side.scrollTop = Math.max(0, rowTop - side.clientHeight / 2 + ROW_HEIGHT / 2)
  }, [activePath, viewRows])

  // UX-P07-F5: Esc cancels an in-flight drag (drop indicator + shared src).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (!dragSrcPath && dropTarget === null) return
      e.preventDefault()
      dragSrcPath = null
      setDropTarget(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dropTarget])

  const virtualize = viewRows.length > VIRTUALIZE_AT
  let start = 0
  let end = viewRows.length
  if (virtualize && viewportH > 0) {
    // row i sits at treeTop + i*ROW_H inside the sidebar's scroll space.
    const treeTop = treeRef.current?.offsetTop ?? 0
    start = Math.max(0, Math.floor((scrollTop - treeTop) / ROW_HEIGHT) - OVERSCAN)
    end = Math.min(
      viewRows.length,
      Math.ceil((scrollTop + viewportH - treeTop) / ROW_HEIGHT) + OVERSCAN
    )
  }

  // 6G: an active create input must render even in an empty tree (the first
  // file of a fresh workspace is created exactly here).
  if (nodes.length === 0 && !pendingCreate) {
    return <div className="outline-empty">{t('tree.noMarkdown')}</div>
  }

  const isDropAllowed = (src: string, destDir: string): boolean =>
    src !== destDir && !destDir.startsWith(src + sep)

  const renderRow = (item: ViewRow): React.JSX.Element => {
    if ('create' in item) {
      return (
        <CreateRow
          key="__create__"
          kind={item.create}
          depth={item.depth}
          virtualize={virtualize}
          onCommit={onCreateCommit}
          onCancel={onCreateCancel}
        />
      )
    }
    const { node, depth, open, relDir } = item
    if (renamingPath && node.path === renamingPath) {
      return (
        <RenameRow
          key={node.path}
          node={node}
          depth={depth}
          virtualize={virtualize}
          onCommit={onRenameCommit}
          onCancel={onRenameCancel}
        />
      )
    }
    const pad = depthStyle(depth)
    const startDrag = (e: React.DragEvent): void => {
      dragSrcPath = node.path
      e.dataTransfer.setData('text/plain', node.path)
      e.dataTransfer.effectAllowed = 'move'
    }
    const endDrag = (): void => {
      dragSrcPath = null
      setDropTarget(null)
    }
    if (node.isDir) {
      return (
        <button
          key={node.path}
          className={`filetree-item filetree-dir-label${
            selectedPath && pathsEqual(selectedPath, node.path) ? ' filetree-selected' : ''
          }${dropTarget === node.path ? ' filetree-drop-target' : ''}${
            item.keyIndex === focusIndex && kbdNav ? ' filetree-kbd-focus' : ''
          }${virtualize ? ' filetree-item-fixed' : ''}`}
          style={pad}
          // FE-06 roving tabindex: one tab stop per tree, data-nav-index is the
          // keyRows index (survives the create-row splice), data-nav-focus marks
          // the focused row for the focus-ring CSS (keyboard only).
          tabIndex={item.keyIndex === tabStop ? 0 : -1}
          data-nav-index={item.keyIndex}
          data-nav-focus={item.keyIndex === focusIndex ? '' : undefined}
          onFocus={() => setFocusIndex(item.keyIndex)}
          onPointerDown={() => setKbdNav(false)}
          draggable
          onDragStart={startDrag}
          onDragEnd={endDrag}
          onDragOver={(e) => {
            const src = dragSrcPath
            if (!src || !isDropAllowed(src, node.path)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDropTarget(node.path)
          }}
          onDragLeave={(e) => {
            // ignore leaves into our own children — the highlight would flicker
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
            setDropTarget((t) => (t === node.path ? null : t))
          }}
          onDrop={(e) => {
            e.preventDefault()
            const src = e.dataTransfer.getData('text/plain') || dragSrcPath
            setDropTarget(null)
            if (src && isDropAllowed(src, node.path)) onMove(src, node.path)
          }}
          onClick={() => {
            // 6D D3: the click selects the row (new-file target) and toggles it.
            onSelect?.(node.path, true)
            setExpanded((m) => ({ ...m, [node.path]: !open }))
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onContextMenu({ x: e.clientX, y: e.clientY, node })
          }}
          title={node.path}
        >
          {indentGuides(depth)}
          <span className="filetree-twisty">{open ? '▾' : '▸'}</span>
          <span className="filetree-icon is-folder">
            {open ? <FolderOpenIcon size={13} /> : <FolderIcon size={13} />}
          </span>
          <span className="filetree-dir-name">{node.name}</span>
        </button>
      )
    }
    return (
      <button
        key={node.path}
        className={`filetree-item${
          activePath && pathsEqual(activePath, node.path) ? ' filetree-active' : ''
        }${selectedPath && pathsEqual(selectedPath, node.path) ? ' filetree-selected' : ''}${
          item.keyIndex === focusIndex && kbdNav ? ' filetree-kbd-focus' : ''
        }${
          virtualize ? ' filetree-item-fixed' : ''
        }`}
        style={pad}
        tabIndex={item.keyIndex === tabStop ? 0 : -1}
        data-nav-index={item.keyIndex}
        data-nav-focus={item.keyIndex === focusIndex ? '' : undefined}
        onFocus={() => setFocusIndex(item.keyIndex)}
        onPointerDown={() => setKbdNav(false)}
        draggable
        onDragStart={startDrag}
        onDragEnd={endDrag}
        onClick={() => {
          // 6D D3: select then open (selection doubles as the new-file target).
          onSelect?.(node.path, false)
          onOpen(node.path)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onContextMenu({ x: e.clientX, y: e.clientY, node })
        }}
        title={node.path}
      >
        {indentGuides(depth)}
        <span className="filetree-twisty empty">·</span>
        <span className="filetree-icon">
          <FileMdIcon size={13} />
        </span>
        {relDir === undefined ? (
          node.name
        ) : (
          <>
            <span className="filetree-list-name">{node.name}</span>
            {relDir ? <span className="filetree-list-sub">{relDir}</span> : null}
          </>
        )}
      </button>
    )
  }

  return (
    <nav
      className="filetree"
      ref={treeRef}
      onKeyDown={onTreeKeyDown}
      onBlur={(e) => {
        // Focus left the tree entirely → drop the DOM-focus mark so the
        // focus-ring presentation attribute never leaks outside the tree.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setFocusIndex(-1)
        setKbdNav(false)
        pendingFocusRef.current = null // no latent .focus() stealing focus back
      }}
      onContextMenu={(e) => {
        // Rows stopPropagation; anything landing on the nav surface itself is
        // empty-area → workspace-root menu (UX-P07-F0).
        if ((e.target as HTMLElement).closest?.('.filetree-item')) return
        e.preventDefault()
        e.stopPropagation()
        onContextMenu({ x: e.clientX, y: e.clientY, node: null })
      }}
    >
      {virtualize ? (
        <>
          <div style={{ height: start * ROW_HEIGHT }} />
          {viewRows.slice(start, end).map(renderRow)}
          <div style={{ height: (viewRows.length - end) * ROW_HEIGHT }} />
        </>
      ) : (
        viewRows.map(renderRow)
      )}
    </nav>
  )
}
