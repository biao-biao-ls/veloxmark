/**
 * App-command accelerators for the macOS native menu. Labels and handlers
 * live in the renderer's command registry (src/renderer/src/commands/);
 * this stays a thin id→accelerator map, and every click forwards as
 * `menu:<id>` so the renderer dispatches through the same registry.
 *
 * 纯数据模块（2.12 自 electron/main.ts 平移）：无 Electron 依赖，主进程
 * commandItem 与 renderer 单测（commands/shortcutSync.test.ts）共引。
 * 与 renderer `Command.shortcut` 是双源——派生规则与例外由该测试守护；
 * 行为约定：bold/italic/inlineCode 故意无加速键（CM6 keymap 拥有 Mod-B/I/E，
 * 原生加速键会与之抢注）。
 */
export const DARWIN_COMMAND_ACCELERATORS: Record<string, string> = {
  newFile: 'Cmd+N',
  openFile: 'Cmd+O',
  openFolder: 'Cmd+Shift+O',
  quickOpen: 'Cmd+P',
  saveFile: 'Cmd+S',
  saveFileAs: 'Cmd+Shift+S',
  openPreferences: 'Cmd+,',
  toggleTheme: 'Cmd+Shift+T',
  // P08 writing modes. UX-P08: Typewriter Mode gains F9 parity with Focus (F8).
  // Inline-format toggles intentionally have NO accelerator here: the CM6
  // keymap owns Mod-B/I/E in the editor, and a native accelerator would race it.
  toggleFocusMode: 'F8',
  toggleTypewriterMode: 'F9',
  toggleSourceMode: 'Cmd+/',
  // P13 folder-wide search.
  globalSearch: 'Cmd+Shift+F',
  // P20 rich-text clipboard (no conflicting registered accelerator).
  copyRichText: 'CmdOrCtrl+Shift+C',
  // P23 format document — same chord as VS Code.
  formatDocument: 'Shift+Alt+F'
}
