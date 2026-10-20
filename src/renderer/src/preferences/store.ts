
import { isUiLang, type UiLang } from '../../../../electron/shared/lang'
import { DEFAULT_TREE_SORT, type TreeSortOptions } from '../filetree/sort'
import { visibleRecents, type RecentFolder } from '../filetree/recents'
import { MIN_COL_WIDTH } from '../editor/table/colWidth'

export const PREFERENCES_VERSION = 1

export type ThemeMode = 'light' | 'dark' | 'system'
export type SidebarMode = 'outline' | 'files' | 'search'
export type FileTreeView = 'tree' | 'list'
export type ImageRenameMode = 'timestamp' | 'keep'
export type AutoSaveMode = 'off' | 'debounce' | 'interval'
export type LanguagePref = 'system' | UiLang

export interface Preferences {
  version: number
  theme: ThemeMode
  editorFontFamily: string
  editorFontSize: number
  editorLineHeight: number
  editorMaxWidth: number
  typingAssistsEnabled: boolean
  wrapBareUrlOnPaste: boolean
  pasteHtmlToMd: boolean
  showLineNumbers: boolean
  restoreLastSession: boolean
  sidebarDefaultOpen: boolean
  attachmentDirName: string
  imageRenameMode: ImageRenameMode
  copyExternalImages: boolean
  downloadRemoteImages: boolean
  folderIgnoreNames: string[]
  recentFolders: RecentFolder[]
  showHiddenFiles: boolean
  fileTreeView: FileTreeView
  fileTreeSort: TreeSortOptions
  focusMode: boolean
  typewriterMode: boolean
  sourceMode: boolean
  autoSaveMode: AutoSaveMode
  autoSaveDelaySec: number
  autoSaveIntervalMin: number
  crashRecoveryEnabled: boolean
  language: LanguagePref
  showStatusBar: boolean
  externalLinkConfirm: boolean
  formatOnSave: boolean
  codeBlockCollapseLines: number
  codeBlockShowLineNumbers: boolean
  codeBlockWrap: boolean
}

export interface SessionState {
  sidebarVisible: boolean | null
  sidebarMode: SidebarMode | null
  sidebarWidth: number | null
  lastFilePath: string | null
  lastFolderPath: string | null
  recentFiles: string[]
  lastCursor: number | null
  headingFolds: Record<string, string[]>
  quoteFolds: Record<string, string[]>
  tableColWidths: Record<string, Record<string, number[]>>
  openTabs: string[]
  activePath: string | null
}

export const RECENT_FILES_MAX = 10

const DEFAULT_FONT_STACK =
  "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif"

export const DEFAULT_PREFERENCES: Preferences = {
  version: PREFERENCES_VERSION,
  theme: 'system',
  editorFontFamily: DEFAULT_FONT_STACK,
  editorFontSize: 16,
  editorLineHeight: 1.6,
  editorMaxWidth: 0,
  typingAssistsEnabled: true,
  wrapBareUrlOnPaste: true,
  pasteHtmlToMd: true,
  showLineNumbers: false,
  restoreLastSession: true,
  sidebarDefaultOpen: true,
  attachmentDirName: 'assets',
  imageRenameMode: 'timestamp',
  copyExternalImages: true,
  downloadRemoteImages: false,
  folderIgnoreNames: ['node_modules', '.git', '.svn', '.hg', 'dist', 'out', 'build', '.DS_Store'],
  recentFolders: [],
  showHiddenFiles: false,
  fileTreeView: 'tree',
  fileTreeSort: { ...DEFAULT_TREE_SORT },
  focusMode: false,
  typewriterMode: false,
  sourceMode: false,
  autoSaveMode: 'debounce',
  autoSaveDelaySec: 3,
  autoSaveIntervalMin: 5,
  crashRecoveryEnabled: true,
  language: 'system',
  showStatusBar: true,
  externalLinkConfirm: true,
  formatOnSave: false,
  codeBlockCollapseLines: 20,
  codeBlockShowLineNumbers: false,
  codeBlockWrap: true,
}

const DEFAULT_SESSION: SessionState = {
  sidebarVisible: null,
  sidebarMode: null,
  sidebarWidth: null,
  lastFilePath: null,
  lastFolderPath: null,
  recentFiles: [],
  lastCursor: null,
  headingFolds: {},
  quoteFolds: {},
  tableColWidths: {},
  openTabs: [],
  activePath: null
}

const PREFS_KEY = 'veloxmark.preferences'
const SESSION_KEY = 'veloxmark.session'


const prefsListeners = new Set<() => void>()
const sessionListeners = new Set<() => void>()

function notify(listeners: Set<() => void>): void {
  listeners.forEach((l) => l())
}

export function subscribePreferences(listener: () => void): () => void {
  prefsListeners.add(listener)
  return () => prefsListeners.delete(listener)
}

export function subscribeSession(listener: () => void): () => void {
  sessionListeners.add(listener)
  return () => sessionListeners.delete(listener)
}


function migrateLegacyKeys(raw: Partial<Preferences>): Partial<Preferences> {
  const next = { ...raw }
  const ls = typeof localStorage !== 'undefined' ? localStorage : null
  if (next.theme == null && ls) {
    const legacyTheme = ls.getItem('theme')
    if (legacyTheme === 'dark' || legacyTheme === 'light') next.theme = legacyTheme
  }
  if (next.typingAssistsEnabled == null && ls) {
    const stored = ls.getItem('enabled')
    if (stored != null) next.typingAssistsEnabled = stored !== 'false'
  }
  if (next.wrapBareUrlOnPaste == null && ls) {
    const stored = ls.getItem('wrapBareUrlOnPaste')
    if (stored != null) next.wrapBareUrlOnPaste = stored !== 'false'
  }
  ls?.removeItem('theme')
  ls?.removeItem('enabled')
  ls?.removeItem('wrapBareUrlOnPaste')
  return next
}

function sanitizeTreeSort(v: unknown): TreeSortOptions {
  const s = (v && typeof v === 'object' ? v : {}) as Partial<TreeSortOptions>
  return {
    groupFolders: s.groupFolders !== false,
    key:
      s.key === 'name' || s.key === 'mtime' || s.key === 'birthtime' ? s.key : 'natural',
    dir: s.dir === 'desc' ? 'desc' : 'asc'
  }
}

function sanitizePreferences(raw: Partial<Preferences> | null): Preferences {
  const p = { ...DEFAULT_PREFERENCES, ...(raw ?? {}) }
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
  return {
    version: PREFERENCES_VERSION,
    theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : 'system',
    editorFontFamily: typeof p.editorFontFamily === 'string' && p.editorFontFamily.trim()
      ? p.editorFontFamily
      : DEFAULT_PREFERENCES.editorFontFamily,
    editorFontSize: num(p.editorFontSize, 16, 8, 48),
    editorLineHeight: num(p.editorLineHeight, 1.6, 1, 3),
    editorMaxWidth: num(p.editorMaxWidth, DEFAULT_PREFERENCES.editorMaxWidth, 0, 4000),
    typingAssistsEnabled: p.typingAssistsEnabled !== false,
    wrapBareUrlOnPaste: p.wrapBareUrlOnPaste !== false,
    pasteHtmlToMd: p.pasteHtmlToMd !== false,
    showLineNumbers: p.showLineNumbers === true,
    restoreLastSession: p.restoreLastSession !== false,
    sidebarDefaultOpen: p.sidebarDefaultOpen !== false,
    attachmentDirName:
      typeof p.attachmentDirName === 'string' &&
      p.attachmentDirName.trim() &&
      !/[\\/:*?"<>|]/.test(p.attachmentDirName.trim())
        ? p.attachmentDirName.trim()
        : DEFAULT_PREFERENCES.attachmentDirName,
    imageRenameMode: p.imageRenameMode === 'keep' ? 'keep' : 'timestamp',
    copyExternalImages: p.copyExternalImages !== false,
    downloadRemoteImages: p.downloadRemoteImages === true,
    folderIgnoreNames: Array.isArray(p.folderIgnoreNames)
      ? [
          ...new Set(
            p.folderIgnoreNames
              .filter((n): n is string => typeof n === 'string')
              .map((n) => n.trim())
              .filter((n) => n !== '')
          )
        ]
      : [...DEFAULT_PREFERENCES.folderIgnoreNames],
    showHiddenFiles: p.showHiddenFiles === true,
    recentFolders: Array.isArray(p.recentFolders)
      ? visibleRecents(
          p.recentFolders
            .filter(
              (e): e is RecentFolder =>
                !!e && typeof (e as RecentFolder).path === 'string' && (e as RecentFolder).path.trim() !== ''
            )
            .map((e) => (e.pinned ? { path: e.path, pinned: true } : { path: e.path }))
        )
      : [],
    fileTreeView: p.fileTreeView === 'list' ? 'list' : 'tree',
    fileTreeSort: sanitizeTreeSort(p.fileTreeSort),
    focusMode: p.focusMode === true,
    formatOnSave: p.formatOnSave === true,
    codeBlockCollapseLines:
      typeof p.codeBlockCollapseLines === 'number' && p.codeBlockCollapseLines >= 0
        ? Math.floor(p.codeBlockCollapseLines)
        : 20,
    codeBlockShowLineNumbers: p.codeBlockShowLineNumbers === true,
    codeBlockWrap: p.codeBlockWrap !== false,
    typewriterMode: p.typewriterMode === true,
    sourceMode: p.sourceMode === true,
    autoSaveMode:
      p.autoSaveMode === 'off' || p.autoSaveMode === 'interval' || p.autoSaveMode === 'debounce'
        ? p.autoSaveMode
        : DEFAULT_PREFERENCES.autoSaveMode,
    autoSaveDelaySec: num(p.autoSaveDelaySec, 3, 1, 60),
    autoSaveIntervalMin: num(p.autoSaveIntervalMin, 5, 1, 60),
    crashRecoveryEnabled: p.crashRecoveryEnabled !== false,
    language: isUiLang(p.language) ? p.language : 'system',
    showStatusBar: p.showStatusBar !== false,
    externalLinkConfirm: p.externalLinkConfirm !== false
  }
}

function readJson<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key)
    return stored ? (JSON.parse(stored) as T) : null
  } catch {
    return null
  }
}

let preferences: Preferences = (() => {
  const raw = readJson<Partial<Preferences>>(PREFS_KEY)
  return sanitizePreferences(migrateLegacyKeys(raw ?? {}))
})()

export function normalizeColWidths(raw: unknown): Record<string, Record<string, number[]>> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, Record<string, number[]>> = {}
  for (const [path, perTable] of Object.entries(raw as Record<string, unknown>)) {
    if (!path || !perTable || typeof perTable !== 'object') continue
    const tables: Record<string, number[]> = {}
    for (const [from, widths] of Object.entries(perTable as Record<string, unknown>)) {
      if (!Array.isArray(widths) || widths.length === 0) continue
      const clean = widths.map((w) =>
        typeof w === 'number' && Number.isFinite(w) && w > 0
          ? Math.max(MIN_COL_WIDTH, Math.round(w))
          : 0
      )
      if (clean.some((w) => w > 0)) tables[from] = clean
    }
    if (Object.keys(tables).length > 0) out[path] = tables
  }
  return out
}

function normalizePerFileIds(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string[]> = {}
  for (const [path, ids] of Object.entries(raw as Record<string, unknown>)) {
    if (!path || !Array.isArray(ids)) continue
    const clean = ids.filter((x): x is string => typeof x === 'string' && x !== '')
    if (clean.length > 0) out[path] = clean
  }
  return out
}

export function normalizeSession(raw: unknown): SessionState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<SessionState>
  return {
    sidebarVisible: typeof r.sidebarVisible === 'boolean' ? r.sidebarVisible : null,
    sidebarMode:
      r.sidebarMode === 'files' || r.sidebarMode === 'outline' || r.sidebarMode === 'search'
        ? r.sidebarMode
        : null,
    sidebarWidth:
      typeof r.sidebarWidth === 'number' && Number.isFinite(r.sidebarWidth)
        ? Math.min(480, Math.max(160, r.sidebarWidth))
        : null,
    lastFilePath: typeof r.lastFilePath === 'string' ? r.lastFilePath : null,
    lastFolderPath: typeof r.lastFolderPath === 'string' ? r.lastFolderPath : null,
    recentFiles: Array.isArray(r.recentFiles)
      ? r.recentFiles.filter((p): p is string => typeof p === 'string').slice(0, RECENT_FILES_MAX)
      : [],
    lastCursor:
      typeof r.lastCursor === 'number' && Number.isFinite(r.lastCursor) && r.lastCursor >= 0
        ? r.lastCursor
        : null,
    openTabs: Array.isArray(r.openTabs)
      ? r.openTabs.filter((p): p is string => typeof p === 'string')
      : [],
    activePath: typeof r.activePath === 'string' ? r.activePath : null,
    headingFolds: normalizePerFileIds(r.headingFolds),
    quoteFolds: normalizePerFileIds(r.quoteFolds),
    tableColWidths: normalizeColWidths(r.tableColWidths)
  }
}

let session: SessionState = normalizeSession(readJson(SESSION_KEY))


export function applyPreferencesCssVars(p: Preferences = preferences): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--editor-font-family', p.editorFontFamily)
  root.style.setProperty('--editor-font-size', `${p.editorFontSize}px`)
  root.style.setProperty('--editor-line-height', String(p.editorLineHeight))
  root.style.setProperty(
    '--editor-max-width',
    p.editorMaxWidth > 0 ? `${p.editorMaxWidth}px` : 'min(100%, clamp(560px, 72%, 1400px))'
  )
}

applyPreferencesCssVars()


export function getPreferences(): Preferences {
  return preferences
}

export function setPreferences(patch: Partial<Preferences>): void {
  preferences = sanitizePreferences({ ...preferences, ...patch })
  localStorage.setItem(PREFS_KEY, JSON.stringify(preferences))
  applyPreferencesCssVars()
  notify(prefsListeners)
}

export function getSession(): SessionState {
  return session
}

export function patchSession(patch: Partial<SessionState>): void {
  session = { ...session, ...patch }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  notify(sessionListeners)
}

export function addRecentFile(path: string): void {
  const recentFiles = [path, ...session.recentFiles.filter((p) => p !== path)].slice(
    0,
    RECENT_FILES_MAX
  )
  patchSession({ recentFiles })
}

export function clearRecentFiles(): void {
  patchSession({ recentFiles: [] })
}

declare global {
  interface Window {
    __veloxPrefs: {
      getPreferences: typeof getPreferences
      getSession: typeof getSession
      setPreferences: typeof setPreferences
      addRecentFile: typeof addRecentFile
      clearRecentFiles: typeof clearRecentFiles
    }
  }
}
if (typeof window !== 'undefined') {
  window.__veloxPrefs = {
    getPreferences,
    getSession,
    setPreferences,
    addRecentFile,
    clearRecentFiles
  }
}
