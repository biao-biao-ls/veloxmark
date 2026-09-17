/**
 * Preferences + session persistence (P03).
 *
 * Preferences (user-facing settings) live under the versioned localStorage key
 * `veloxmark.preferences`; high-churn session state (sidebar, recent files,
 * last paths) lives under `veloxmark.session` so opening a file does not
 * rewrite the settings blob. Both use a small pub/sub so React binds via
 * useSyncExternalStore (see preferences/useStore.ts).
 *
 * Appearance settings are pushed to `:root` as CSS variables; editor/theme.ts
 * consumes them, so every setPreferences() takes effect immediately.
 */

export const PREFERENCES_VERSION = 1

export type ThemeMode = 'light' | 'dark' | 'system'
export type SidebarMode = 'outline' | 'files'
export type ImageRenameMode = 'timestamp' | 'keep'

export interface Preferences {
  version: number
  theme: ThemeMode
  editorFontFamily: string
  /** px */
  editorFontSize: number
  editorLineHeight: number
  /** px; 0 = unlimited (full-width editor) */
  editorMaxWidth: number
  typingAssistsEnabled: boolean
  wrapBareUrlOnPaste: boolean
  showLineNumbers: boolean
  restoreLastSession: boolean
  /** Initial sidebar visibility when no session memory exists. */
  sidebarDefaultOpen: boolean
  // ---- images (P05) ----------------------------------------------------------
  /** Attachment subdirectory under the document directory (e.g. "assets"). */
  attachmentDirName: string
  /** How dropped/imported files outside the doc directory are named in assets. */
  imageRenameMode: ImageRenameMode
  /** Copy image files dragged from outside the doc directory into assets. */
  copyExternalImages: boolean
  /** Download pasted/dropped remote image URLs into assets instead of keeping them. */
  downloadRemoteImages: boolean
  // ---- folder workspace (P07) ------------------------------------------------
  /** File-tree entry names to hide; `*` / `?` wildcards, matched in main. */
  folderIgnoreNames: string[]
  /** Include `.`-prefixed entries in the file tree (still subject to ignores). */
  showHiddenFiles: boolean
}

export interface SessionState {
  sidebarVisible: boolean | null
  sidebarMode: SidebarMode | null
  sidebarWidth: number | null
  lastFilePath: string | null
  lastFolderPath: string | null
  /** Most-recent-first, max 10. */
  recentFiles: string[]
}

export const RECENT_FILES_MAX = 10

const DEFAULT_FONT_STACK =
  "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', -apple-system, sans-serif"

export const DEFAULT_PREFERENCES: Preferences = {
  version: PREFERENCES_VERSION,
  theme: 'light',
  editorFontFamily: DEFAULT_FONT_STACK,
  editorFontSize: 16,
  editorLineHeight: 1.6,
  editorMaxWidth: 0,
  typingAssistsEnabled: true,
  wrapBareUrlOnPaste: true,
  showLineNumbers: true,
  restoreLastSession: true,
  sidebarDefaultOpen: true,
  attachmentDirName: 'assets',
  imageRenameMode: 'timestamp',
  copyExternalImages: true,
  downloadRemoteImages: false,
  folderIgnoreNames: ['node_modules', '.git', '.svn', '.hg', 'dist', 'out', 'build', '.DS_Store'],
  showHiddenFiles: false
}

const DEFAULT_SESSION: SessionState = {
  sidebarVisible: null,
  sidebarMode: null,
  sidebarWidth: null,
  lastFilePath: null,
  lastFolderPath: null,
  recentFiles: []
}

const PREFS_KEY = 'veloxmark.preferences'
const SESSION_KEY = 'veloxmark.session'

// ---- pub/sub ----------------------------------------------------------------

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

// ---- load / migrate ---------------------------------------------------------

/** One-time import of the pre-P03 standalone localStorage keys. */
function migrateLegacyKeys(raw: Partial<Preferences>): Partial<Preferences> {
  const next = { ...raw }
  if (next.theme == null) {
    const legacyTheme = localStorage.getItem('theme')
    if (legacyTheme === 'dark' || legacyTheme === 'light') next.theme = legacyTheme
  }
  if (next.typingAssistsEnabled == null) {
    const stored = localStorage.getItem('enabled')
    if (stored != null) next.typingAssistsEnabled = stored !== 'false'
  }
  if (next.wrapBareUrlOnPaste == null) {
    const stored = localStorage.getItem('wrapBareUrlOnPaste')
    if (stored != null) next.wrapBareUrlOnPaste = stored !== 'false'
  }
  localStorage.removeItem('theme')
  localStorage.removeItem('enabled')
  localStorage.removeItem('wrapBareUrlOnPaste')
  return next
}

function sanitizePreferences(raw: Partial<Preferences> | null): Preferences {
  const p = { ...DEFAULT_PREFERENCES, ...(raw ?? {}) }
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
  return {
    version: PREFERENCES_VERSION,
    theme: p.theme === 'dark' || p.theme === 'system' ? p.theme : 'light',
    editorFontFamily: typeof p.editorFontFamily === 'string' && p.editorFontFamily.trim()
      ? p.editorFontFamily
      : DEFAULT_PREFERENCES.editorFontFamily,
    editorFontSize: num(p.editorFontSize, 16, 8, 48),
    editorLineHeight: num(p.editorLineHeight, 1.6, 1, 3),
    editorMaxWidth: num(p.editorMaxWidth, 0, 0, 4000),
    typingAssistsEnabled: p.typingAssistsEnabled !== false,
    wrapBareUrlOnPaste: p.wrapBareUrlOnPaste !== false,
    showLineNumbers: p.showLineNumbers !== false,
    restoreLastSession: p.restoreLastSession !== false,
    sidebarDefaultOpen: p.sidebarDefaultOpen !== false,
    // A path separator here would let a pref escape the document directory.
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
    showHiddenFiles: p.showHiddenFiles === true
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
  // migrateLegacyKeys is a no-op once the pre-P03 keys are consumed.
  return sanitizePreferences(migrateLegacyKeys(raw ?? {}))
})()

let session: SessionState = (() => {
  const raw = readJson<Partial<SessionState>>(SESSION_KEY)
  if (!raw) return { ...DEFAULT_SESSION }
  return {
    sidebarVisible: typeof raw.sidebarVisible === 'boolean' ? raw.sidebarVisible : null,
    sidebarMode: raw.sidebarMode === 'files' || raw.sidebarMode === 'outline' ? raw.sidebarMode : null,
    sidebarWidth:
      typeof raw.sidebarWidth === 'number' && Number.isFinite(raw.sidebarWidth)
        ? Math.min(480, Math.max(160, raw.sidebarWidth))
        : null,
    lastFilePath: typeof raw.lastFilePath === 'string' ? raw.lastFilePath : null,
    lastFolderPath: typeof raw.lastFolderPath === 'string' ? raw.lastFolderPath : null,
    recentFiles: Array.isArray(raw.recentFiles)
      ? raw.recentFiles.filter((p): p is string => typeof p === 'string').slice(0, RECENT_FILES_MAX)
      : []
  }
})()

// ---- CSS variable injection (live appearance preview) -----------------------

export function applyPreferencesCssVars(p: Preferences = preferences): void {
  const root = document.documentElement
  root.style.setProperty('--editor-font-family', p.editorFontFamily)
  root.style.setProperty('--editor-font-size', `${p.editorFontSize}px`)
  root.style.setProperty('--editor-line-height', String(p.editorLineHeight))
  root.style.setProperty(
    '--editor-max-width',
    p.editorMaxWidth > 0 ? `${p.editorMaxWidth}px` : '100%'
  )
}

// Apply synchronously at module load so the editor is never built against
// missing variables.
applyPreferencesCssVars()

// ---- accessors / mutations --------------------------------------------------

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

/** Move `path` to the front of the recent list (dedupe, cap at 10). */
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

// Handle for CDP smoke tests (scripts/cdp-p03.mjs) — no other runtime consumers.
declare global {
  interface Window {
    __veloxPrefs: {
      getPreferences: typeof getPreferences
      getSession: typeof getSession
      addRecentFile: typeof addRecentFile
      clearRecentFiles: typeof clearRecentFiles
    }
  }
}
window.__veloxPrefs = { getPreferences, getSession, addRecentFile, clearRecentFiles }
