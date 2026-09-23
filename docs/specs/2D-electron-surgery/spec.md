# 2D electron 小手术（2.18–2.21）

## What / Why

`main.ts` 579 行混窗口生命周期与 macOS 原生菜单（~280 行）；`whenReady` 内联 5 个游离 handler；IPC channel 字符串在 preload/ipc 各写一遍裸字面量（改名无编译守护）；`ipc/window.ts` 错位收纳 clipboard/shell/app:setState。按 2.20 → 2.18 → 2.19 → 2.21 动刀（契约先行：channel 常量先落，handler 搬家时即用新引用）。

## 验收标准（AC）

1. **2.20 `IpcChannels` 常量**：`shared/api.ts` 增 `export const IpcChannels = { … } as const`（56 channel，key = `domainAction` 骼峰），preload 与 `ipc/*`、`main.ts` 的裸字面量全部改从常量取值；`onMenu(channel: string)` **收窄**为 `onMenu(id: string, …)`（preload 内部 `menuChannel(id)` 前缀），消费方（useMenus + App 6 处）改传裸 id
2. **2.18 `electron/menu/darwin.ts`**：`NATIVE_MENU_STRINGS` + `buildDarwinMenu` + `rebuildDarwinMenu` + `recentFilesSubmenu` + `commandItem` + `NATIVE_CHECKBOX_COMMANDS` + `uiLang`/持久化 + `recentFiles`/`nativeCheckedIds` **状态随迁**（它们是菜单状态）→ `menu/darwin.ts`；main.ts 经 `initDarwinMenu(getWindow)` 注入窗口访问（放大/devTools/最近文件点击均走 getter）。加速键表已在 `shared/commandAccelerators.ts`（2.12），`commandItem` 从 shared 取
3. **2.19 游离 handler 归位**：`app:rendererReady`/`app:setRecentFiles`/`app:setMenuCheckedIds`/`app:setLanguage`/`app:closeResponse` → **新建 `ipc/app.ts`**（`app:` channel 域全集），`registerAllIpc(getWindow, appDeps)` 聚合；`AppIpcDeps` 注入 `{ onRendererReady, approveClose, setRecentFiles, setMenuCheckedIds, setUiLanguage }`（ipc 层不依赖 menu 层——menu sync 三个是 darwin 导出函数，前两个是 main 的生命周期闭包；`closeApproved` 标志留 main）
4. **2.21 `ipc/window.ts` 域归位**：`clipboard:*` 6 个 → 新建 `ipc/clipboard.ts`；`shell:openExternal` → 新建 `ipc/shell.ts`（顺带收 `files.ts` 的 `shell:showItemInFolder` 凑齐 `shell:` 域）；`app:setState` → `ipc/app.ts`；`window:*` 5 个 + `zoomBy` 留 `window.ts`
5. **解既有类型环**：`GetWindow` 从 `ipc/index.ts` 迁到叶子模块 `ipc/getWindow.ts`（files/folder/image/window/app 的 type import 改走叶子）——既消 2B 记录的 4 个 madge 环，也避免 `ipc/app` 新增环；`ipc/index` re-export 兼容
6. 行为不变：typecheck 双配置 + unit 全绿；renderer 与 electron madge **均 0 cycles**；`window.api` 面（除 onMenu 签名收窄）与 `menu:<id>`/push channel 字符串值全部不变

## 不做

- **App/useMenus 双派发缺陷不修**：App 的 `menu:closeTab`/`menu:reopenClosedTab`/`menu:nextTab` 三监听与 useMenus 的全命令 `menu:<id>` 订阅重复（原生菜单单击会双执行，reopenClosedTab 会重开两张）——本单元机械收窄保持原状，修复属行为变更，另立
- `NATIVE_MENU_STRINGS` 并入渲染端 i18n key 空间（3D/3.17）；`ipc/files.ts` 其余错位（如 `file:resolveImageSrc`）；channel 字符串**值**的任何改动；`onMenu` 之外的 RendererApi 签名变化

## 方案（Plan）

- **纯平移为主**。唯一 API 形状变化 = `onMenu` 收窄（task 2.20 明示）；`IpcChannels` 键名由 channel 值机械派生（`dialog:openFile → dialogOpenFile`），值一个字符不动
- `menuChannel(id) => \`menu:${id}\`` 落 `shared/api.ts`（动态 `menu:<id>` 家族按设计不进常量表，固定入口 `openRecent`/`clearRecent`/`closeTabOrWindow` 在调用点以裸 id 出现）
- `menu/darwin.ts` 模块级 `getWindow` getter（与仓库模块单例惯用法一致）；zoom/devTools/最近文件点击都经 getter；`sendMenu` 平移为模块私有
- `ipc/app.ts` 是纯 channel 接线 + deps 注入（与 `registerAllIpc(getWindow)` 同风格）；handler 返回值语义保持（`app:setLanguage` 仍 `return true`）
- 依赖方向（无环）：`ipc/getWindow` 叶子；`menu/darwin` → `ipc/window`(zoomBy)/`shared/*`；`ipc/app` → `shared/*` + `ipc/getWindow`（type）；`ipc/index` → 全部 register*（聚合）

## 任务拆分

1. 2.20：`IpcChannels` + `menuChannel` + `onMenu` 收窄（api/preload/ipc.*/main/App/useMenus 全量替换字面量）
2. 2.18：`menu/darwin.ts` 状态+装配外提（main.ts 只剩生命周期/协议/窗口）
3. 2.19 + 2.21：`ipc/getWindow.ts` 叶子 + `ipc/app.ts` + `ipc/clipboard.ts` + `ipc/shell.ts`，window.ts/files.ts 瘦身，`registerAllIpc` 聚合更新
4. 收敛（typecheck + unit + 双侧 madge 0 cycles + channel 值 diff 清单 + 勾销 2.18–2.21）
