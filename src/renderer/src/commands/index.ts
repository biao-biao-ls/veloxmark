/**
 * Command registry — single source for menu labels, shortcuts and handlers.
 *
 * The in-app MenuBar, the global keydown and the macOS native-menu dispatch
 * are all generated from this list. Adding a command = one entry in the
 * matching domain builder, plus one id→accelerator line in
 * electron/shared/commandAccelerators.ts (darwin menu only; kept honest by
 * commands/shortcutSync.test.ts).
 *
 * 实现按职责分模块（2B 拆分），本文件是纯 re-export 面：
 *   types.ts            Command / CommandOps（六域窄接口）/ RecentItem
 *   fileCmds.ts …       六域 builder（concat 序见 build.ts 文件头）
 *   build.ts            buildCommands 装配
 *   shortcutDisplay.ts  fmtShortcut（⌘/⇧ 显示转换）
 *   shortcutMatch.ts    matchGlobalShortcut（全局 keydown 匹配）
 *   menuLayout.ts       MENU_LAYOUT + buildMenus + Open Recent 子菜单
 *   commandCache.ts     setCtxRuntime 热路径的命令表 Map 缓存
 * 命令 id 字面量是 cdp 探针契约：保持 `id: '…'` 单行字面，不可改、不可模板化。
 * （探针扫描范围需覆盖 src/renderer/src/commands/**。）
 */
export type {
  Command,
  CommandOps,
  EditCmdOps,
  FileCmdOps,
  FormatCmdOps,
  InsertCmdOps,
  RecentItem,
  TabsCmdOps,
  ViewCmdOps
} from './types'
export { buildCommands } from './build'
export { fmtShortcut } from './shortcutDisplay'
export { matchGlobalShortcut } from './shortcutMatch'
export { buildMenus } from './menuLayout'
export { createCommandCache } from './commandCache'
