# 2B 拆 commands.ts（874 行 → commands/ 目录）

## What / Why

`commands.ts` 874 行混四件事：71 条命令表（按域分段的数组字面量）、菜单布局装配、快捷键显示/匹配、公共类型面。按 2.8–2.12 切模块，并顺手治两个既有债：App `setCtxRuntime` 热路径每次调用重建全表（2.11）、renderer `shortcut` 与 `electron/main.ts` `DARWIN_COMMAND_ACCELERATORS` 双源无守护（2.12）。

## 验收标准（AC）

1. **2.8 零风险外提**：`fmtShortcut` → `commands/shortcutDisplay.ts`；`matchGlobalShortcut` → `commands/shortcutMatch.ts`（**顺手补单测** `shortcutMatch.test.ts`：chorded Ctrl/Cmd、Shift 精确匹配、Bare-F 键拒修饰、macOS Option 字符 `e.code` 兜底（KeyF/BracketLeft/BracketRight）、Ctrl+Alt 组与 Shift+Alt 组）；`LayoutItem`/`MENU_LAYOUT`/`buildMenus`/`buildRecentSubmenu` → `commands/menuLayout.ts`
2. **2.9 域拆**：`buildCommands` → `commands/fileCmds.ts`/`editCmds.ts`/`formatCmds.ts`/`tabsCmds.ts`/`viewCmds.ts`/`insertCmds.ts`，各返回 `Command[]` 后 concat。**命令 id 字面量不可改**，且 `id: 'heading1'` 等保持单行字面形式（cdp 探针正则扫描；模板 id 探针不可见）
3. **2.10 `CommandOps` 拆域**：28 字段 → `FileCmdOps & EditCmdOps & FormatCmdOps & TabsCmdOps & ViewCmdOps & InsertCmdOps`（命名带 `Cmd` 后缀——避让 `e2e/seams/types.ts` 已占用的 `FileOps`）；合并后字段集不变 → **App.tsx `commandOps` 字面量与 `useMenus.Args` 零改动**（结构兼容）
4. **2.11 命令表 Map 缓存**：App `setCtxRuntime` 的 `runCommand`/`isCommandDisabled` 不再每次调用 `buildCommands().find(id)` → `commands/commandCache.ts`（按 ops 身份失效重建；run 闭包新鲜度与现状等价——`commandOps` 每 render 新对象即每 render 至多重建一次）
5. **2.12 快捷键双源守护**：`DARWIN_COMMAND_ACCELERATORS` 提为 `electron/shared/commandAccelerators.ts` 纯数据模块（`main.ts` 改 import；无 Electron 依赖，单测可直引）；新增 `commands/shortcutSync.test.ts` 双源一致性测试——表中每个 entry ↔ 对应 `Command.shortcut` 的 `Ctrl+→Cmd+` 派生关系，例外登记 `copyRichText → CmdOrCtrl+Shift+C`，并钉住 bold/italic/inlineCode **故意无加速键**的现状
6. **模块解析**：`commands.ts` → `commands/index.ts`（`moduleResolution: bundler`，`from './commands'` 两消费方零改动）；converge：typecheck + unit 全绿、madge 0 cycles、id/缝契约核验；**探针扫描范围需扩至 `src/renderer/src/commands/**`**（`scripts/cdp-*.mjs` 不在本仓库，记录为契约同步项）

## 不做

- 命令行为/快捷键绑定任何改动——含 `reopenClosedTab` 与 `toggleTheme` 同为 `Ctrl+Shift+T`、前者（tabs 域）遮蔽后者的现状：concat 序固定为 file → edit → format → tabs → view → insert，保持该对相对序
- `useMenus` 每 render 重建 `commands` 的模式（只治 2.11 点名的 setCtxRuntime 热路径）
- `MENU_LAYOUT` 结构/菜单位置调整；`NATIVE_MENU_STRINGS` 并入 key 空间（3D）；`onMenu(\`menu:${id}\`)` 通道约定不动

## 方案（Plan）

- **纯平移为主**。域归属：File 段 + `showHelp`（loadContent 家族）→ fileCmds；Edit 段 + `copyAs*` 两条 → editCmds；`formatDocument` + 「Inline format + P27」段（lift/headingN/paragraph/lists/links）→ formatCmds；P26 → tabsCmds；View 段（folds/modes/zoom/devtools/theme）→ viewCmds；Insert（P16/P21/P22）→ insertCmds。跨段挪位仅 `showHelp`/`copyAs*`/`formatDocument` 三处，均无快捷键冲突（唯一 bindGlobal 冲突对 `reopenClosedTab`→`toggleTheme` 相对序经 concat 序保持）
- 各域文件本地一行 `const view = (): EditorView | null => ops.viewRef.current`（原 buildCommands 内闭包的平移副本）
- 域 builder 签名 `buildXxxCmds(ops: XxxCmdOps): Command[]`——`CommandOps extends` 六域接口后字段集与现 28 个逐一相同（类型收窄无运行时影响）；共享字段（`viewRef`/`saveFileAs`/`showToast`）在多个域接口重复声明，类型相同合并合法
- 2.12 的共享数据落 `electron/shared/`（tsconfig.node 含 `electron/**`；`e2e/handles.d.ts` 已有 src→electron/shared 跨界 import 先例）；2.18 抽 `menu/darwin.ts` 时 `commandItem` 从 shared 取表，不再随迁
- 依赖方向（无环）：domain 文件 → types/纯 editor 模块；menuLayout → shortcutDisplay + types；commandCache → index；index → 全部

## 任务拆分

1. 2.8：shortcutDisplay / shortcutMatch（+单测）/ menuLayout 外提
2. 2.9 + 2.10：types.ts 域接口 + 六域 builder + index barrel（删 commands.ts）
3. 2.11：commandCache.ts + App.tsx 热路径接线
4. 2.12：commandAccelerators.ts 外提 + shortcutSync.test.ts；converge（typecheck + unit + madge + 行数记录 + 勾销 2.8–2.12）
