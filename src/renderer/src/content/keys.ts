import { fmtShortcut } from '../commands/shortcutDisplay'

const isMacPlatform = typeof window !== 'undefined' && window.api?.platform === 'darwin'

export const OPEN_KEY = fmtShortcut('Ctrl+O', isMacPlatform)
export const SAVE_KEY = fmtShortcut('Ctrl+S', isMacPlatform)
