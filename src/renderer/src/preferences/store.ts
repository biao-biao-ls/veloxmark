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
export type SidebarMode = 'outline' | 'files' | 'search'
/** 6D D7: files-tab rendering — tree vs flat list (list render lands in 6.12). */
export type FileTreeView = 'tree' | 'list'
export type ImageRenameMode = 'timestamp' | 'keep'
export type AutoSaveMode = 'off' | 'debounce' | 'interval'
/** P14: UI language — 'system' follows navigator.language. */
export type LanguagePref = 'system' | 'zh' | 'en'

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
  /** P19: convert rich-text (text/html) paste payloads to Markdown. */
  pasteHtmlToMd: boolean
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
  /** 6D D7: file-tree view mode (render fork lands in 6.12). */
  fileTreeView: FileTreeView
  // ---- focus modes (P08) -----------------------------------------------------
  /** Dim every top-level block the cursor is not in. */
  focusMode: boolean
  /** Keep the cursor line vertically centered while editing. */
  typewriterMode: boolean
  /** Raw Markdown view — live-preview decorations off. */
  sourceMode: boolean
  // ---- autosave & crash recovery (P12) ---------------------------------------
  /** off | input-debounce (N seconds) | fixed interval (N minutes). */
  autoSaveMode: AutoSaveMode
  /** Debounce delay in seconds when autoSaveMode === 'debounce'. */
  autoSaveDelaySec: number
  /** Interval in minutes when autoSaveMode === 'interval'. */
  autoSaveIntervalMin: number
  /** Write crash-recovery drafts + offer restore on startup. */
  crashRecoveryEnabled: boolean
  // ---- i18n & status bar (P14) ----------------------------------------------
  /** UI language; 'system' resolves via navigator.language at boot. */
  language: LanguagePref
  /** Bottom status bar (cursor / word count / mode lamps). */
  showStatusBar: boolean
  // ---- link navigation (P17) -------------------------------------------------
  /** Confirm before shell.openExternal on http(s) links (default on). */
  externalLinkConfirm: boolean
  // ---- P23 document formatting ---------------------------------------------
  /** Run formatMarkdown before every save (default off). */
  formatOnSave: boolean
  // ---- P24 code-block display ----------------------------------------------
  /** Collapse code blocks longer than N lines (0 = never). */
  codeBlockCollapseLines: number
  /** Line-number column inside rendered code blocks. */
  codeBlockShowLineNumbers: boolean
  /** Soft-wrap long lines inside code blocks. */
  codeBlockWrap: boolean
  // ---- P25 mermaid live preview ---------------------------------------------
  /** Height (px) of the mermaid source-preview panel split. */
  mermaidPreviewHeight: number
}

export interface SessionState {
  sidebarVisible: boolean | null
  sidebarMode: SidebarMode | null
  sidebarWidth: number | null
  lastFilePath: string | null
  lastFolderPath: string | null
  /** Most-recent-first, max 10. */
  recentFiles: string[]
  /** P12: editor cursor offset restored with the last file. */
  lastCursor: number | null
  /** P18: heading-fold keys (`level:text`) per file path. */
  headingFolds: Record<string, string[]>
  /** P25: mermaid preview panel pinned (session-only). */
  mermaidPreviewPin: boolean
  /** P26: open document tabs (file paths, tab order). */
  openTabs: string[]
  /** P26: active tab path at session end (null = untitled). */
  activePath: string | null
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
  // F05/5B: new installs get a readable 800px content column. Stored 0
  // means the auto-fit soft cap (min(90%, 1200px)) — sanitizePreferences
  // spreads raw over these defaults, so an explicit value in storage wins.
  editorMaxWidth: 800,
  typingAssistsEnabled: true,
  wrapBareUrlOnPaste: true,
  pasteHtmlToMd: true,
  // 5B (behavior change): line numbers are opt-in — default off for a quiet
  // reading column. Stored explicit true keeps the gutter.
  showLineNumbers: false,
  restoreLastSession: true,
  sidebarDefaultOpen: true,
  attachmentDirName: 'assets',
  imageRenameMode: 'timestamp',
  copyExternalImages: true,
  downloadRemoteImages: false,
  folderIgnoreNames: ['node_modules', '.git', '.svn', '.hg', 'dist', 'out', 'build', '.DS_Store'],
  showHiddenFiles: false,
  fileTreeView: 'tree',
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
  mermaidPreviewHeight: 240
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
  mermaidPreviewPin: false,
  openTabs: [],
  activePath: null
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
  // P15: unit tests import this module in a DOM-less node environment —
  // guard the legacy-key reads the same way readJson guards its own.
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
    editorMaxWidth: num(p.editorMaxWidth, DEFAULT_PREFERENCES.editorMaxWidth, 0, 4000),
    typingAssistsEnabled: p.typingAssistsEnabled !== false,
    wrapBareUrlOnPaste: p.wrapBareUrlOnPaste !== false,
    pasteHtmlToMd: p.pasteHtmlToMd !== false,
    showLineNumbers: p.showLineNumbers === true,
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
    showHiddenFiles: p.showHiddenFiles === true,
    fileTreeView: p.fileTreeView === 'list' ? 'list' : 'tree',
    focusMode: p.focusMode === true,
    formatOnSave: p.formatOnSave === true,
    codeBlockCollapseLines:
      typeof p.codeBlockCollapseLines === 'number' && p.codeBlockCollapseLines >= 0
        ? Math.floor(p.codeBlockCollapseLines)
        : 20,
    codeBlockShowLineNumbers: p.codeBlockShowLineNumbers === true,
    codeBlockWrap: p.codeBlockWrap !== false,
    mermaidPreviewHeight:
      typeof p.mermaidPreviewHeight === 'number' && Number.isFinite(p.mermaidPreviewHeight)
        ? Math.min(800, Math.max(120, p.mermaidPreviewHeight))
        : 240,
    typewriterMode: p.typewriterMode === true,
    sourceMode: p.sourceMode === true,
    autoSaveMode:
      p.autoSaveMode === 'off' || p.autoSaveMode === 'interval' || p.autoSaveMode === 'debounce'
        ? p.autoSaveMode
        : DEFAULT_PREFERENCES.autoSaveMode,
    autoSaveDelaySec: num(p.autoSaveDelaySec, 3, 1, 60),
    autoSaveIntervalMin: num(p.autoSaveIntervalMin, 5, 1, 60),
    crashRecoveryEnabled: p.crashRecoveryEnabled !== false,
    language: p.language === 'zh' || p.language === 'en' ? p.language : 'system',
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
  // migrateLegacyKeys is a no-op once the pre-P03 keys are consumed.
  return sanitizePreferences(migrateLegacyKeys(raw ?? {}))
})()

let session: SessionState = (() => {
  const raw = readJson<Partial<SessionState>>(SESSION_KEY)
  if (!raw) return { ...DEFAULT_SESSION }
  return {
    sidebarVisible: typeof raw.sidebarVisible === 'boolean' ? raw.sidebarVisible : null,
    sidebarMode:
      raw.sidebarMode === 'files' || raw.sidebarMode === 'outline' || raw.sidebarMode === 'search'
        ? raw.sidebarMode
        : null,
    sidebarWidth:
      typeof raw.sidebarWidth === 'number' && Number.isFinite(raw.sidebarWidth)
        ? Math.min(480, Math.max(160, raw.sidebarWidth))
        : null,
    lastFilePath: typeof raw.lastFilePath === 'string' ? raw.lastFilePath : null,
    lastFolderPath: typeof raw.lastFolderPath === 'string' ? raw.lastFolderPath : null,
    recentFiles: Array.isArray(raw.recentFiles)
      ? raw.recentFiles.filter((p): p is string => typeof p === 'string').slice(0, RECENT_FILES_MAX)
      : [],
    lastCursor:
      typeof raw.lastCursor === 'number' && Number.isFinite(raw.lastCursor) && raw.lastCursor >= 0
        ? raw.lastCursor
        : null,
    mermaidPreviewPin: raw.mermaidPreviewPin === true,
    openTabs: Array.isArray(raw.openTabs)
      ? raw.openTabs.filter((p): p is string => typeof p === 'string')
      : [],
    activePath: typeof raw.activePath === 'string' ? raw.activePath : null,
    headingFolds:
      raw.headingFolds && typeof raw.headingFolds === 'object'
        ? Object.fromEntries(
            Object.entries(raw.headingFolds)
              .filter(([, v]) => Array.isArray(v))
              .map(([k, v]) => [
                k,
                (v as unknown[]).filter((x): x is string => typeof x === 'string')
              ])
          )
        : {}
  }
})()

// ---- CSS variable injection (live appearance preview) -----------------------

export function applyPreferencesCssVars(p: Preferences = preferences): void {
  // P15: DOM-less vitest imports pull this module in — no document, no-op.
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--editor-font-family', p.editorFontFamily)
  root.style.setProperty('--editor-font-size', `${p.editorFontSize}px`)
  root.style.setProperty('--editor-line-height', String(p.editorLineHeight))
  root.style.setProperty(
    '--editor-max-width',
    // 5B: 0 = auto-fit soft cap. Keep the expression in sync with the
    // --editor-max-width default in styles/tokens.css (pre-injection value).
    p.editorMaxWidth > 0 ? `${p.editorMaxWidth}px` : 'min(90%, 1200px)'
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
      setPreferences: typeof setPreferences
      addRecentFile: typeof addRecentFile
      clearRecentFiles: typeof clearRecentFiles
    }
  }
}
// P15: guarded — vitest imports this module in a DOM-less node environment.
if (typeof window !== 'undefined') {
  window.__veloxPrefs = {
    getPreferences,
    getSession,
    setPreferences,
    addRecentFile,
    clearRecentFiles
  }
}
