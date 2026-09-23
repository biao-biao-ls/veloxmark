# 3A 拆 useFileOps.ts

## What / Why

`hooks/useFileOps.ts`（1018 行）混居多标签模型、文件 IO、关闭策略三域，且 **dirty 三轨**（`dirtyRef` / `tab.dirty` / `setDirty` state）与 **savedContent 双写**（`savedContentRef` / `tab.savedContent`）跨 useFileOps / App / useAutoSave 三模块散落写入。先立单一真源契约（3.1），再抽公共类型/工具（3.2），然后按域拆 `useTabStore` / `useDocIo` / `tabClosePolicy`（3.3–3.5），返回对象保持 facade 兼容（3.6）。

## 背景与现状

- **三轨写入面（12 处）**：useFileOps 内部 8 处（activateTab/initTabs/loadContent×2/markActiveSaved/saveAllDirtyTabs/refreshTabs 兜底拷贝）；App 3 处裸写（L458-461 draft 恢复 untitled、L483-488 draft 恢复 path、L604-608 编辑 onChange 置脏）；useAutoSave 1 处（L117-120 untitled 草稿存盘清脏）。
- **5 处散落判断** `isActive ? dirtyRef.current : tab.dirty`：refreshTabs / saveAllDirtyTabs / queryClose×2 / closeTab。
- **savedContentRef 是写-only 镜像**（全仓 0 处 `.current` 读）；`tab.savedContent` 是内容兜底（inactive tab `state?.doc ?? savedContent`）与闭栈快照来源。useAutoSave untitled 路径写 savedContentRef 后会被 `refreshTabs` 用旧 `tab.savedContent` 覆盖——现存竞态，因无读者而不可见。
- **SidebarMode 双声明**：`preferences/store.ts:17`（App/SearchPanel/seams 消费）与 `useFileOps.ts:20`（useWorkspaceTree 消费）。
- **路径工具重复**：useFileOps `baseDirOf`/`baseNameOf`（L56-62）；App 内联变体 4 处（L295 baseName 等价、L1472 `[/]`-only 变体、L1474 baseName+`||p` 兜底、L1447 保留尾分隔符变体）；useExport L117 baseName+去扩展名。
- **消费面（facade 契约）**：App（`fileOps` 全量 + 3 处裸写）、useAutoSave（Args：`dirtyRef`/`savedContentRef`/`saveFile`/`saveAllDirtyTabs`/`setDirty`/`syncAppState`）、useWorkspaceTree（Args：`openDocPath`/`filePathRef`/`confirmDiscard`/`loadContent`/`setSidebarMode`/`setBaseDir`）、TabsBar（`DocTabInfo` 类型）、e2e/seams（`FileOps = ReturnType<typeof useFileOps>`；p12/p26 `getDirty` 读 `dirtyRef.current`）。

## 验收标准（AC）

- **AC1（3.1 dirty/savedContent 单一真源）**：`DocTab.dirty` + `DocTab.savedContent` 是唯一真源（active tab 含）；`dirtyRef`/`dirty` state/`savedContentRef` 降级为 active 投影镜像，**只经 mutator 写入**（`setActiveDirty` / `setSavedBaseline` / `markActiveSaved` 重写为组合）；5 处 `isActive ? dirtyRef.current : tab.dirty` 全部收敛为 `isTabDirty(tab)`；App 3 处 + useAutoSave 1 处裸写改走 mutator（等价性证明见 plan，含 useAutoSave 现路径 ≡ `markActiveSaved(content, null)` 的逐行对照）。
- **AC2（3.2 公共类型/工具）**：`hooks/docTabs.ts`（`DocTab`/`DocTabInfo` 单源声明）；`pathUtil.ts`（`baseDirOf`/`baseNameOf`）+ 同目录单测；`SidebarMode` 单源 = `preferences/store.ts` 声明 + useFileOps re-export 兼容（useWorkspaceTree 零改动）；App/useExport 等价内联变体去重（**非等价变体不强行合并**，注释标注差异）。
- **AC3（3.3 `hooks/useTabStore.ts`）**：tab Map CRUD（`initTabs`/`activateTab`/`newFile`/`closeTab`/`closeOtherTabs`/`closeTabsRight`/`nextTab`/`prevTab`/`activateTabById`/`reorderTab`/`reopenClosedTab`/`listTabs`/`tabOrder`/`findTabIdByPath`/`tabContent`/`getTabCount`/`getActiveTabId`/`getActiveBaseDir`/`persistTabsSession`/`resetToWelcome`）+ 3.1 mutators + `refreshTabs`/`makeState`/`reapplyViewState`/`syncAppState`/`setBaseDir`/`currentDocText` 装配；`makeState` 经 `extensionsRef` 注入。
- **AC4（3.4 `hooks/useDocIo.ts`）**：`openDocPath`/`loadContent`/`saveFile`/`saveFileAs`/`saveAllDirtyTabs`/`reloadTabFromDisk`/`maybeFormatForSave`/`markActiveSaved` + `openFile`/`openFromSystem`/`openRecentFile`/`openFileByPath` 薄包装 + `notifySaveFailed`。
- **AC5（3.5 `hooks/tabClosePolicy.ts`）**：`confirmDiscard`/`queryClose` + `closeTab` 的 dirty 分支整体（P12 三选一对话框语义、save-on-close 写失败保 tab、untitled-active Save As 分支、draft 丢弃语义）。
- **AC6（3.6 facade 兼容）**：`useFileOps` 收为组合壳，返回对象 key 集**不减**（可新增 `markActiveSaved` 供 useAutoSave 绑定）；App/useWorkspaceTree/TabsBar/e2e 缝零改动；hook 名 `useFileOps` 不改。
- **AC7**：`npm run typecheck && npm run test:unit` 全绿；`npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles；e2e 缝形状不变（`__veloxP12`/`__veloxP26` 的 `getDirty`、`FileOps` 类型编译钉住）。

## 约束

- **行为不变**：对话框文案/按钮/时序、P12 三选一语义、P26 关末标签关窗语义、draft 保留语义、`suppressDirtyRef` 守卫语义均不变；`syncAppState` **调用点不移动**（main 进程脏点/标题通知时机保持现状，含现存的不一致处——不借拆分之机「顺手修」）。
- dirty 读值在所有可观测点（tabInfos 圆点、queryClose 对话框、autosave 判脏、e2e getDirty）与现状一致。
- e2e 硬契约：返回表面（`FileOps`）、`window.__veloxP12`/`__veloxP26`。
- Constitution：新纯模块（pathUtil）配单测；hook 装配层（useTabStore/useDocIo）不要求单测；`tabClosePolicy` 以显式 deps 纯函数风格书写（可测性留待后续）。

## 不做

- 不改 useAutoSave 的双管线语义（draft/autosave debounce），仅绑定面新增 `markActiveSaved`。
- 不动 App 业务回调装配（1.3 范畴）；不改 `commands`/Menus 消费面。
- 不做 `useFileOps` 更名/返回值对象重构（facade key 名逐字保留）。
- 不修 `syncAppState` 既有调用不一致（如 App L458-461 不通知 main）——行为不变约束明示保留。
